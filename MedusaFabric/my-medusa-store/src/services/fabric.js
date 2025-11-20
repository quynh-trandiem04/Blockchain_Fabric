// src/services/fabric.js (Đây là Fabric Service chính)

const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const crypto = require('crypto');

// === CẤU HÌNH VÀ KHÓA RSA ===
const KEY_PATH = path.resolve(process.cwd(), 'keys');
const ARTIFACTS_PATH = process.cwd(); // Medusa Backend root
const CHANNEL_NAME = 'orderchannel';
const CC_NAME = 'ecommerce';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

function hybridEncrypt(dataString, rsaPublicKey) {
    const symmetricKey = crypto.randomBytes(KEY_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, symmetricKey, iv);
    let encryptedData = cipher.update(dataString, 'utf8', 'base64');
    encryptedData += cipher.final('base64');
    const authTag = cipher.getAuthTag();
    const encryptedKey = crypto.publicEncrypt({ key: rsaPublicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, symmetricKey);
    return JSON.stringify({ iv: iv.toString('base64'), authTag: authTag.toString('base64'), encryptedKey: encryptedKey.toString('base64'), encryptedData: encryptedData });
}

function hybridDecrypt(blobString, rsaPrivateKey) {
    const { iv, authTag, encryptedKey, encryptedData } = JSON.parse(blobString);
    const ivBuffer = Buffer.from(iv, 'base64');
    const authTagBuffer = Buffer.from(authTag, 'base64');
    const decryptedSymmetricKey = crypto.privateDecrypt({ key: rsaPrivateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(encryptedKey, 'base64'));
    const decipher = crypto.createDecipheriv(ALGORITHM, decryptedSymmetricKey, ivBuffer);
    decipher.setAuthTag(authTagBuffer);
    let decryptedData = decipher.update(encryptedData, 'base64', 'utf8');
    decryptedData += decipher.final('utf8');
    return decryptedData;
}

// SỬA: Class không cần kế thừa AbstractService nữa
class FabricService {
    // Constructor nhận container (dependency injection)
    constructor() {
        this.config = this._loadKeys();
        this.connected = false;
    }

    _loadKeys() {
        try {
            return {
                SELLER_PUBLIC: fs.readFileSync(path.join(KEY_PATH, 'seller_public_key.pem'), 'utf8'),
                SHIPPER_PUBLIC: fs.readFileSync(path.join(KEY_PATH, 'shipper_public_key.pem'), 'utf8'),
                SELLER_PRIVATE: fs.readFileSync(path.join(KEY_PATH, 'seller_private_key.pem'), 'utf8'),
                SHIPPER_PRIVATE: fs.readFileSync(path.join(KEY_PATH, 'shipper_private_key.pem'), 'utf8'),
            };
        } catch (e) {
            console.error("FABRIC ERROR: Failed to load RSA keys. Check 'keys' folder.");
            // Không throw error ngay để tránh crash server khi khởi động nếu thiếu key
            return {}; 
        }
    }

    // ... (Giữ nguyên toàn bộ các phương thức _getContract, createOrder, queryOrder, decrypt...) ...
    
    async _getContract() {
        if (this.connected) return { gateway: this.gateway, contract: this.contract };

        const ccpPath = path.join(ARTIFACTS_PATH, 'connection-profile.yaml');
        const ccp = yaml.load(fs.readFileSync(ccpPath, 'utf8'));
        const walletPath = path.join(ARTIFACTS_PATH, 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        const identity = await wallet.get('admin');

        if (!identity) throw new Error('Fabric Admin identity not found. Run enrollAdmin.js.');

        this.gateway = new Gateway();
        await this.gateway.connect(ccp, {
            wallet,
            identity: 'admin',
            discovery: { enabled: true, asLocalhost: false }
        });

        const network = await this.gateway.getNetwork(CHANNEL_NAME);
        this.contract = network.getContract(CC_NAME);
        this.connected = true;

        return { gateway: this.gateway, contract: this.contract };
    }

    async createOrder(data) {
        const { contract } = await this._getContract();
        const sellerPayload = JSON.stringify({
            customerName: data.customerName, product_lines: data.product_lines,
            amount_untaxed: data.amount_untaxed, amount_total: data.amount_total
        });
        const shipperPayload = JSON.stringify({
            customerName: data.customerName, shipping_address: data.shipping_address,
            shipping_phone: data.shipping_phone, cod_amount: data.cod_amount
        });
        const encryptedSellerBlob = hybridEncrypt(sellerPayload, this.config.SELLER_PUBLIC);
        const encryptedShipperBlob = hybridEncrypt(shipperPayload, this.config.SHIPPER_PUBLIC);

        // 3. Gọi hàm 'CreateOrder' (Cách mới để lấy TX ID)
        
        // Bước A: Tạo đối tượng giao dịch (nhưng chưa gửi)
        const transaction = contract.createTransaction('CreateOrder');
        
        // Bước B: Lấy Transaction ID ngay lập tức
        const generatedTxId = transaction.getTransactionId();
        console.log(`Generated TX ID: ${generatedTxId}`);

        // Bước C: Gửi giao dịch với các tham số
        await transaction.submit(
            data.orderID, 
            data.paymentMethod, 
            data.sellerID, 
            data.shipperID,
            encryptedSellerBlob, 
            encryptedShipperBlob
        );

        // Bước D: Trả về Transaction ID thực sự
        return generatedTxId;
    }

    async queryOrder(orderId) {
        const { contract } = await this._getContract();
        const result = await contract.evaluateTransaction('QueryOrder', orderId);
        return JSON.parse(result.toString());
    }

    async decryptSellerData(orderId) {
        const orderData = await this.queryOrder(orderId);
        const encryptedBlobString = orderData.seller_sensitive_data;
        if (!encryptedBlobString || encryptedBlobString === "SELLER_BLOB_FOR_CLI_TEST") {
            throw new Error("Invalid or CLI test data.");
        }
        const decryptedPayload = hybridDecrypt(encryptedBlobString, this.config.SELLER_PRIVATE);
        return JSON.parse(decryptedPayload);
    }

    async decryptShipperData(orderId) {
        const orderData = await this.queryOrder(orderId);
        const encryptedBlobString = orderData.shipper_sensitive_data;
        if (!encryptedBlobString || encryptedBlobString === "SHIPPER_BLOB_FOR_CLI_TEST") {
            throw new Error("Invalid or CLI test data.");
        }
        const decryptedPayload = hybridDecrypt(encryptedBlobString, this.config.SHIPPER_PRIVATE);
        return JSON.parse(decryptedPayload);
    }
}

module.exports = FabricService;