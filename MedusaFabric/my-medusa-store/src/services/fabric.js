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
        this.gateways = {}; 
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

    async _getContract(orgName = 'admin') {
        // Mapping tên Org sang tên User trong Wallet
        // Giả sử bạn đã enroll các user này vào wallet:
        // 'admin' -> Admin của EcommercePlatform (Mặc định)
        // 'seller' -> Admin hoặc User của SellerOrg
        const identityMap = {
            'admin': 'admin', 
            'sellerorgmsp': 'seller_admin',   // <--- Khớp với IDENTITY_LABEL trong enrollSeller.js
            'shipperorgmsp': 'shipper_admin', // <--- Khớp với IDENTITY_LABEL trong enrollShipper.js
            'ecommerceplatformorgmsp': 'admin'
        };

        const userId = identityMap[orgName] || 'admin';

        // Nếu đã có kết nối cho user này thì dùng lại
        if (this.gateways[userId]) {
            const network = await this.gateways[userId].getNetwork(CHANNEL_NAME);
            return { contract: network.getContract(CC_NAME) };
        }

        const ccpPath = path.join(ARTIFACTS_PATH, 'connection-profile.yaml');
        const ccp = yaml.load(fs.readFileSync(ccpPath, 'utf8'));
        const walletPath = path.join(ARTIFACTS_PATH, 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        const identity = await wallet.get(userId);

        if (!identity) {
            console.warn(`⚠️ Warning: Identity '${userId}' not found in wallet. Fallback to 'admin'.`);
            // Nếu không tìm thấy user seller, thử fallback về admin (nhưng sẽ bị lỗi quyền nếu chaincode chặn)
            if (userId !== 'admin') return this._getContract('admin');
            throw new Error(`Identity '${userId}' not found. Run enrollment script.`);
        }

        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: userId,
            discovery: { enabled: true, asLocalhost: false } // Đổi asLocalhost: true nếu chạy local docker
        });

        console.log(`✅ Fabric Gateway connected as: ${userId}`);
        this.gateways[userId] = gateway;

        const network = await gateway.getNetwork(CHANNEL_NAME);
        return { contract: network.getContract(CC_NAME) };
}

    async createOrder(data) {
        const { contract } = await this._getContract();
        
        const sellerPayload = JSON.stringify({
            customerName: data.customerName, 
            product_lines: data.product_lines,
            amount_untaxed: data.amount_untaxed, 
            amount_total: data.amount_total
        });

        const shipperPayload = JSON.stringify({
            customerName: data.customerName, 
            shipping_address: data.shipping_address,
            shipping_phone: data.shipping_phone, 
            shipping_fee: data.shipping_total,
            cod_amount: data.cod_amount
        });

        const encryptedSellerBlob = hybridEncrypt(sellerPayload, this.config.SELLER_PUBLIC);
        const encryptedShipperBlob = hybridEncrypt(shipperPayload, this.config.SHIPPER_PUBLIC);

        // === FIX: CÁCH LẤY TX ID CHUẨN ===
        
        // 1. Tạo Transaction Object
        const transaction = contract.createTransaction('CreateOrder');
        
        // 2. Lấy ID Giao dịch ngay lập tức
        const txId = transaction.getTransactionId();
        console.log(`[FabricService] Generated TX ID: ${txId}`);

        // 3. Gửi giao dịch (Submit)
        await transaction.submit(
            data.orderID, 
            data.paymentMethod, 
            data.sellerID, 
            data.shipperID,
            encryptedSellerBlob, 
            encryptedShipperBlob
        );

        // 4. Trả về ID để Subscriber/API sử dụng
        return txId;
    }

    async queryOrder(orderId) {
        const { contract } = await this._getContract();
        const result = await contract.evaluateTransaction('QueryOrder', orderId);
        return JSON.parse(result.toString());
    }

    async decryptSellerData(orderId) {
        const orderData = await this.queryOrder(orderId);
        const encryptedBlobString = orderData.seller_sensitive_data;
        
        if (!encryptedBlobString || encryptedBlobString.includes("TEST")) {
              delete orderData.seller_sensitive_data;
             delete orderData.shipper_sensitive_data;
             return { ...orderData, decrypted: false };
        }

        const decryptedPayload = hybridDecrypt(encryptedBlobString, this.config.SELLER_PRIVATE);
        const decryptedJson = JSON.parse(decryptedPayload);

        const finalResult = {
            ...orderData,   
            ...decryptedJson
        };

        delete finalResult.seller_sensitive_data;
        delete finalResult.shipper_sensitive_data;
        return finalResult;
    }

    async decryptShipperData(orderId) {
        const orderData = await this.queryOrder(orderId);
        const encryptedBlobString = orderData.shipper_sensitive_data;
        
        if (!encryptedBlobString || encryptedBlobString.includes("TEST")) {
             delete orderData.seller_sensitive_data;
             delete orderData.shipper_sensitive_data;
             return { ...orderData, decrypted: false };
        }

        const decryptedPayload = hybridDecrypt(encryptedBlobString, this.config.SHIPPER_PRIVATE);
        const decryptedJson = JSON.parse(decryptedPayload);

        const finalResult = {
            ...orderData,
            ...decryptedJson
        };

        delete finalResult.seller_sensitive_data;
        delete finalResult.shipper_sensitive_data;

        return finalResult;
    }

    async confirmPayment(orderId) {
        const { contract } = await this._getContract();
        
        console.log(`[FabricService] Confirming payment for order: ${orderId}`);
 
        const result = await contract.submitTransaction('ConfirmPayment', orderId);

        return result ? result.toString() : 'CONFIRMED_VALID';
    }

    async shipOrder(orderId, role = 'sellerorgmsp') {
        const { contract } = await this._getContract(role);
        
        console.log(`[FabricService] Executing ShipOrder for: ${orderId} as ${role}`);
        
        const result = await contract.submitTransaction('ShipOrder', orderId);
        
        return result ? result.toString() : 'SHIPPED_SUCCESS';
    }

    async confirmDelivery(orderId) {
        const { contract } = await this._getContract('shipperorgmsp'); 
        
        console.log(`[FabricService] Executing ConfirmDelivery for: ${orderId}`);
        
        const result = await contract.submitTransaction('ConfirmDelivery', orderId);
        
        return result ? result.toString() : 'DELIVERY_CONFIRMED';
    }
    
}
module.exports = FabricService;