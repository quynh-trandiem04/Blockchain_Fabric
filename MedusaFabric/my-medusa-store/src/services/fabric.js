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
    // 1. Tạo khóa đối xứng (AES Key) ngẫu nhiên
    const symmetricKey = crypto.randomBytes(KEY_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // 2. Mã hóa dữ liệu bằng AES
    const cipher = crypto.createCipheriv(ALGORITHM, symmetricKey, iv);
    let encryptedData = cipher.update(dataString, 'utf8', 'base64');
    encryptedData += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    // 3. Mã hóa khóa AES bằng RSA Public Key của người nhận
    const encryptedKey = crypto.publicEncrypt({ 
        key: rsaPublicKey, 
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, 
        oaepHash: 'sha256' 
    }, symmetricKey);

    return JSON.stringify({ 
        iv: iv.toString('base64'), 
        authTag: authTag.toString('base64'), 
        encryptedKey: encryptedKey.toString('base64'), 
        encryptedData: encryptedData 
    });
}

function hybridDecrypt(blobString, rsaPrivateKey) {
    const { iv, authTag, encryptedKey, encryptedData } = JSON.parse(blobString);
    
    // 1. Giải mã khóa AES bằng RSA Private Key
    const ivBuffer = Buffer.from(iv, 'base64');
    const authTagBuffer = Buffer.from(authTag, 'base64');
    const decryptedSymmetricKey = crypto.privateDecrypt({ 
        key: rsaPrivateKey, 
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, 
        oaepHash: 'sha256' 
    }, Buffer.from(encryptedKey, 'base64'));

    // 2. Giải mã dữ liệu bằng khóa AES vừa lấy được
    const decipher = crypto.createDecipheriv(ALGORITHM, decryptedSymmetricKey, ivBuffer);
    decipher.setAuthTag(authTagBuffer);
    let decryptedData = decipher.update(encryptedData, 'base64', 'utf8');
    decryptedData += decipher.final('utf8');
    
    return decryptedData;
}

// SỬA: Class không cần kế thừa AbstractService nữa
class FabricService {
    // Constructor nhận container (Dependency Injection từ Medusa)
    constructor(container) {
        this.container = container;
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
            console.error("FABRIC ERROR: Failed to load RSA keys. Ensure 'keys' folder exists with keys.");
            return {}; 
        }
    }

    // Helper: Kết nối tới Gateway
    async _getContract(orgIdentityLabel = 'admin') {
        // Mapping tên Org/Role sang tên User cụ thể trong Wallet
        // Trong môi trường Production, Identity này nên được lấy dynamic theo User đang login
        const identityMap = {
            'admin': 'admin', // Admin của Sàn
            'ecommerceplatformorgmsp': 'admin',
            
            // Các user này phải được Enroll bằng Fabric-CA và có file trong folder wallet/
            'sellerorgmsp': 'seller_admin',   
            'shipperorgmsp': 'shipper_admin', 
        };

        // Nếu orgIdentityLabel truyền vào không có trong map, giả sử nó là ID user trực tiếp (cho trường hợp dynamic)
        const userId = identityMap[orgIdentityLabel] || orgIdentityLabel;

        // Reuse connection nếu đã có
        if (this.gateways[userId]) {
            const network = await this.gateways[userId].getNetwork(CHANNEL_NAME);
            return { contract: network.getContract(CC_NAME), gateway: this.gateways[userId] };
        }

        const ccpPath = path.join(ARTIFACTS_PATH, 'connection-profile.yaml');
        if (!fs.existsSync(ccpPath)) {
            throw new Error(`Connection profile missing at: ${ccpPath}`);
        }
        const ccp = yaml.load(fs.readFileSync(ccpPath, 'utf8'));
        
        const walletPath = path.join(ARTIFACTS_PATH, 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        
        const identity = await wallet.get(userId);

        if (!identity) {
            console.warn(`⚠️ Warning: Identity '${userId}' not found in wallet. Using 'admin' as fallback.`);
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
        return { contract: network.getContract(CC_NAME), gateway };
}

    async createOrder(data) {
        // Mặc định Seller hoặc Admin tạo đơn. 
        // Nếu muốn chính xác Seller tạo, truyền 'sellerorgmsp' hoặc UserID cụ thể vào _getContract
        const { contract } = await this._getContract('sellerorgmsp'); 
        
        // Payload dữ liệu nhạy cảm (Private Data)
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

        // Mã hóa
        const encryptedSellerBlob = hybridEncrypt(sellerPayload, this.config.SELLER_PUBLIC);
        const encryptedShipperBlob = hybridEncrypt(shipperPayload, this.config.SHIPPER_PUBLIC);

        console.log(`[FabricService] Sending CreateOrder: ID=${data.orderID}, Shipper=${data.shipperCompanyID}`);
        
        const transaction = contract.createTransaction('CreateOrder');
        
        // Lấy TxID để lưu vào DB Medusa
        const txId = transaction.getTransactionId();

        // Gửi giao dịch (Submit)
        // Args: orderID, paymentMethod, shipperCompanyID, sellerBlob, shipperBlob
        await transaction.submit(
            data.orderID, 
            data.paymentMethod, 
            data.shipperCompanyID,
            encryptedSellerBlob, 
            encryptedShipperBlob
        );

        // 4. Trả về ID để Subscriber/API sử dụng
        return txId;
    }

    // =========================================================================
    // 2. QUERY ORDER (Truy vấn đơn hàng)
    // =========================================================================
    async queryOrder(orderId) {
        // Lưu ý: Kết quả trả về phụ thuộc vào Identity gọi hàm (ABAC)
        const { contract } = await this._getContract('admin'); 
        const result = await contract.evaluateTransaction('QueryOrder', orderId);
        return JSON.parse(result.toString());
    }

    // =========================================================================
    // 3. DECRYPT DATA (Giải mã dữ liệu)
    // =========================================================================
    async decryptSellerData(orderId) {
        // Phải dùng identity của Seller để đọc
        const { contract } = await this._getContract('sellerorgmsp');
        const result = await contract.evaluateTransaction('QueryOrder', orderId);
        const orderData = JSON.parse(result.toString());

        const encryptedBlobString = orderData.seller_sensitive_data;
        
        if (!encryptedBlobString || !this.config.SELLER_PRIVATE) {
             return { ...orderData, decrypted: false };
        }

        try {
        const decryptedPayload = hybridDecrypt(encryptedBlobString, this.config.SELLER_PRIVATE);
        const decryptedJson = JSON.parse(decryptedPayload);
            return { ...orderData, ...decryptedJson, decrypted: true };
        } catch (e) {
            console.error("Decryption failed:", e.message);
            return { ...orderData, decrypted: false, error: "Decryption Failed" };
        }
    }

    async decryptShipperData(orderId) {
        // Phải dùng identity của Shipper để đọc
        const { contract } = await this._getContract('shipperorgmsp');
        const result = await contract.evaluateTransaction('QueryOrder', orderId);
        const orderData = JSON.parse(result.toString());

        const encryptedBlobString = orderData.shipper_sensitive_data;
        
        if (!encryptedBlobString || !this.config.SHIPPER_PRIVATE) {
             return { ...orderData, decrypted: false };
        }

        try {
        const decryptedPayload = hybridDecrypt(encryptedBlobString, this.config.SHIPPER_PRIVATE);
        const decryptedJson = JSON.parse(decryptedPayload);
            return { ...orderData, ...decryptedJson, decrypted: true };
        } catch (e) {
            console.error("Decryption failed:", e.message);
            return { ...orderData, decrypted: false, error: "Decryption Failed" };
        }
    }

    // =========================================================================
    // 4. TRANSACTION FUNCTIONS (Các hàm đổi trạng thái)
    // =========================================================================

    async confirmPayment(orderId) {
        const { contract } = await this._getContract('admin'); // Sàn gọi
        console.log(`[FabricService] Confirming payment: ${orderId}`);
        const result = await contract.submitTransaction('ConfirmPayment', orderId);
        return result ? result.toString() : 'CONFIRMED_VALID';
    }

    async shipOrder(orderId, role = 'shipperorgmsp') {
        const { contract } = await this._getContract(role);
        console.log(`[FabricService] Executing ShipOrder: ${orderId} as ${role}`);
        const result = await contract.submitTransaction('ShipOrder', orderId);
        return result ? result.toString() : 'SHIPPED_SUCCESS';
    }

    async confirmDelivery(orderId) {
        const { contract } = await this._getContract('shipperorgmsp');
        console.log(`[FabricService] Executing ConfirmDelivery: ${orderId}`);
        const result = await contract.submitTransaction('ConfirmDelivery', orderId);       
        return result ? result.toString() : 'DELIVERY_CONFIRMED';
    }

    async confirmCODDelivery(orderId) {
        const { contract } = await this._getContract('shipperorgmsp'); // Shipper gọi
        console.log(`[FabricService] Executing ConfirmCODDelivery: ${orderId}`);
        const result = await contract.submitTransaction('ConfirmCODDelivery', orderId);
        return result ? result.toString() : 'COD_DELIVERY_CONFIRMED';
    }

    async remitCOD(orderId) {
        const { contract } = await this._getContract('admin'); // Sàn gọi
        console.log(`[FabricService] Executing RemitCOD: ${orderId}`);
        const result = await contract.submitTransaction('RemitCOD', orderId);
        return result ? result.toString() : 'COD_REMITTED';
    }

    async payoutToSeller(orderId) {
        const { contract } = await this._getContract('admin'); 
        
        console.log(`[FabricService] Executing PayoutToSeller for: ${orderId}`);
        
        const result = await contract.submitTransaction('PayoutToSeller', orderId);
        
        return result ? result.toString() : 'PAYOUT_SUCCESS';
    }

    async requestReturn(orderId) {
        const { contract } = await this._getContract('admin'); 
        
        console.log(`[FabricService] Executing RequestReturn for: ${orderId}`);
        
        const result = await contract.submitTransaction('RequestReturn', orderId);
        
        return result ? result.toString() : 'RETURN_REQUESTED_SUCCESS';
    }

    async shipReturn(orderId) {
        const { contract } = await this._getContract('shipperorgmsp'); 
        
        console.log(`[FabricService] Executing ShipReturn for: ${orderId}`);
        
        const result = await contract.submitTransaction('ShipReturn', orderId);
        
        return result ? result.toString() : 'RETURN_IN_TRANSIT_SUCCESS';
    }

    async confirmReturnReceived(orderId) {
        const { contract } = await this._getContract('sellerorgmsp');
        
        console.log(`[FabricService] Executing ConfirmReturnReceived for: ${orderId}`);
        
        const result = await contract.submitTransaction('ConfirmReturnReceived', orderId);
        
        return result ? result.toString() : 'RETURN_RECEIVED_SUCCESS';
    }
}
module.exports = FabricService;