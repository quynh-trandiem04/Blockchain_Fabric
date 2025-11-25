'use strict';
const express = require('express');
const cors = require('cors');
const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const crypto = require('crypto');

// =================================================================
// CẤU HÌNH CƠ BẢN & KHÓA RSA
// =================================================================
const app = express();
const PORT = 5001;
const HOST = '0.0.0.0';
const CHANNEL_NAME = 'orderchannel';
const CC_NAME = 'ecommerce';

app.use(cors());
app.use(express.json());

const KEY_PATH = path.resolve(__dirname, 'keys');
let SELLER_PUBLIC_KEY, SHIPPER_PUBLIC_KEY, SELLER_PRIVATE_KEY, SHIPPER_PRIVATE_KEY;

try {
    SELLER_PUBLIC_KEY = fs.readFileSync(path.join(KEY_PATH, 'seller_public_key.pem'), 'utf8');
    SHIPPER_PUBLIC_KEY = fs.readFileSync(path.join(KEY_PATH, 'shipper_public_key.pem'), 'utf8');
    SELLER_PRIVATE_KEY = fs.readFileSync(path.join(KEY_PATH, 'seller_private_key.pem'), 'utf8');
    SHIPPER_PRIVATE_KEY = fs.readFileSync(path.join(KEY_PATH, 'shipper_private_key.pem'), 'utf8');
} catch (e) {
    console.error("LỖI NGHIÊM TRỌNG: Không thể tải file khóa. Hãy chạy 'openssl' để tạo 4 file .pem trong thư mục 'keys'.");
    process.exit(1);
}

// =================================================================
// CÁC HÀM HELPER (Mã hóa / Giải mã / Kết nối)
// =================================================================
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
    const encryptedKey = crypto.publicEncrypt(
        {
            key: rsaPublicKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256',
        },
        symmetricKey
    );
    return JSON.stringify({
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        encryptedKey: encryptedKey.toString('base64'),
        encryptedData: encryptedData
    });
}

function hybridDecrypt(blobString, rsaPrivateKey) {
    const { iv, authTag, encryptedKey, encryptedData } = JSON.parse(blobString);
    const ivBuffer = Buffer.from(iv, 'base64');
    const authTagBuffer = Buffer.from(authTag, 'base64');
    const decryptedSymmetricKey = crypto.privateDecrypt(
        {
            key: rsaPrivateKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256',
        },
        Buffer.from(encryptedKey, 'base64')
    );
    const decipher = crypto.createDecipheriv(ALGORITHM, decryptedSymmetricKey, ivBuffer);
    decipher.setAuthTag(authTagBuffer);
    let decryptedData = decipher.update(encryptedData, 'base64', 'utf8');
    decryptedData += decipher.final('utf8');
    return decryptedData;
}

async function getGatewayContract() {
    const ccpPath = path.resolve(__dirname, 'connection-profile.yaml');
    const ccp = yaml.load(fs.readFileSync(ccpPath, 'utf8'));
    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    const identity = await wallet.get('admin');
    if (!identity) {
        throw new Error('Danh tính "admin" không tìm thấy. Hãy chạy enrollAdmin.js');
    }
    const gateway = new Gateway();
    await gateway.connect(ccp, {
        wallet,
        identity: 'admin',
        discovery: { enabled: true, asLocalhost: true }
    });
    const network = await gateway.getNetwork(CHANNEL_NAME);
    const contract = network.getContract(CC_NAME);
    return { gateway, contract };
}

// =================================================================
// CÁC API ENDPOINTS
// =================================================================

app.get('/', (req, res) => {
    res.send("Chào mừng đến API Gateway V3.0 (Hybrid-Encryption)!");
});

// --- API Endpoint 1: TRUY VẤN (Đọc) ---
app.get('/api/queryOrder/:order_id', async (req, res) => {
    const orderId = req.params.order_id;
    let gateway;
    try {
        const { gateway: gw, contract } = await getGatewayContract();
        gateway = gw;
        const result = await contract.evaluateTransaction('QueryOrder', orderId); 
        res.status(200).json(JSON.parse(result.toString()));
    } catch (error) {
        console.error(`Lỗi khi query: ${error}`);
        res.status(500).json({ error: error.toString() });
    } finally {
        if (gateway) gateway.disconnect();
    }
});


// --- API Endpoint 2: CREATE ORDER (Ghi) [ĐÃ SỬA LỖI] ---
app.post('/api/createOrder', async (req, res) => {
    console.log(`--- Nhận request [CreateOrder V3.1 - Hybrid] ---`);
    let gateway;
    try {
        const { gateway: gw, contract } = await getGatewayContract();
        gateway = gw;

        // 1. Lấy TẤT CẢ dữ liệu (plaintext + sensitive) từ Odoo
        const data = req.body;

        // 2. Chuẩn bị các gói dữ liệu riêng tư (dựa trên thiết kế V3.0)
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
            cod_amount: data.cod_amount
        });

        // 3. Mã hóa dữ liệu (SỬ DỤNG HYBRID ENCRYPTION)
        const encryptedSellerBlob = hybridEncrypt(sellerPayload, SELLER_PUBLIC_KEY);
        const encryptedShipperBlob = hybridEncrypt(shipperPayload, SHIPPER_PUBLIC_KEY);

        // 4. Gọi hàm 'CreateOrder' (Submit)
        console.log("Đang gửi 6 tham số (gồm 2 blob mã hóa lai) lên chaincode...");
        
        // FIX: Đảm bảo truyền 6 tham số đúng vị trí cho V3.0/V4.0
        const result = await contract.submitTransaction(
            'CreateOrder',
            data.orderID,
            data.paymentMethod,
            data.sellerID,
            data.shipperID,
            encryptedSellerBlob,
            encryptedShipperBlob
        );
        
        // FIX LỖI ỔN ĐỊNH: Đảm bảo luôn xử lý kết quả commit, kể cả khi rỗng
        const txId = result ? result.toString() : '';
        console.log("Giao dịch CreateOrder thành công!");
        res.status(200).json({ message: 'Giao dịch CreateOrder (V3.1) thành công!', tx_id: txId });

    } catch (error) {
        console.error(`Lỗi khi invoke V3.1: ${error}`);
        // TRÁNH LỖI TypeError: Đảm bảo luôn trả về JSON hợp lệ
        res.status(500).json({ error: error.toString() });
    } finally {
        if (gateway) gateway.disconnect();
    }
});

// --- API Endpoints 3 -> 12: CÁC HÀM INVOKE KHÁC (Cần thiết cho hệ thống) ---
function createInvokeHandler(chaincodeFunction, successMessage) {
    return async (req, res) => {
        const { orderID } = req.body;
        if (!orderID) return res.status(400).json({ error: "Thiếu 'orderID' trong body" });
        
        let gateway;
        try {
            const { gateway: gw, contract } = await getGatewayContract();
            gateway = gw;
            const result = await contract.submitTransaction(chaincodeFunction, orderID);
            const txId = result ? result.toString() : ''; 
            res.status(200).json({ message: successMessage, tx_id: txId });
            
        } catch (error) {
            console.error(`Lỗi khi invoke ${chaincodeFunction}: ${error}`);
            res.status(500).json({ error: error.toString() });
        } finally {
            if (gateway) gateway.disconnect();
        }
    };
}

// Gán các hàm invoke vào các endpoint
app.post('/api/confirmPayment', createInvokeHandler('ConfirmPayment', 'Xác nhận thanh toán thành công!'));
app.post('/api/cancelOrder', createInvokeHandler('CancelOrder', 'Hủy đơn hàng thành công!'));
app.post('/api/shipOrder', createInvokeHandler('ShipOrder', 'Xác nhận bàn giao vận chuyển thành công!'));
app.post('/api/confirmDelivery', createInvokeHandler('ConfirmDelivery', 'Xác nhận giao hàng (Prepaid) thành công!'));
app.post('/api/confirmCODDelivery', createInvokeHandler('ConfirmCODDelivery', 'Xác nhận giao hàng (COD) thành công!'));
app.post('/api/remitCOD', createInvokeHandler('RemitCOD', 'Xác nhận nộp tiền COD thành công!'));
app.post('/api/payoutToSeller', createInvokeHandler('PayoutToSeller', 'Xác nhận thanh toán cho Nhà Bán thành công!'));
app.post('/api/requestReturn', createInvokeHandler('RequestReturn', 'Yêu cầu trả hàng thành công!'));
app.post('/api/shipReturn', createInvokeHandler('ShipReturn', 'Xác nhận gửi trả hàng thành công!'));
app.post('/api/confirmReturnReceived', createInvokeHandler('ConfirmReturnReceived', 'Xác nhận đã nhận hàng trả thành công!'));

// --- API DEMO GIẢI MÃ ---
app.get('/api/decryptForSeller/:order_id', async (req, res) => {
    const orderId = req.params.order_id;
    let gateway;
    try {
        const { gateway: gw, contract } = await getGatewayContract();
        gateway = gw;
        const result = await contract.evaluateTransaction('QueryOrder', orderId);
        const orderData = JSON.parse(result.toString());
        
        const encryptedBlobString = orderData.seller_sensitive_data;
        if (!encryptedBlobString || encryptedBlobString === "SELLER_BLOB_FOR_CLI_TEST") {
            return res.status(400).json({error: "Dữ liệu không phải JSON mã hóa hợp lệ. Hãy chạy lại qua API."});
        }
        
        const decryptedPayload = hybridDecrypt(encryptedBlobString, SELLER_PRIVATE_KEY);
        res.status(200).json(JSON.parse(decryptedPayload));

    } catch (error) { 
        res.status(500).json({ error: error.toString() }); 
    } finally { 
        if (gateway) gateway.disconnect(); 
    }
});

app.get('/api/decryptForShipper/:order_id', async (req, res) => {
    const orderId = req.params.order_id;
    let gateway;
    try {
        const { gateway: gw, contract } = await getGatewayContract();
        gateway = gw;
        const result = await contract.evaluateTransaction('QueryOrder', orderId);
        const orderData = JSON.parse(result.toString());
        
        const encryptedBlobString = orderData.shipper_sensitive_data;
        if (!encryptedBlobString || encryptedBlobString === "SHIPPER_BLOB_FOR_CLI_TEST") {
            return res.status(400).json({error: "Dữ liệu không phải JSON mã hóa hợp lệ. Hãy chạy lại qua API."});
        }
        
        const decryptedPayload = hybridDecrypt(encryptedBlobString, SHIPPER_PRIVATE_KEY); 
        res.status(200).json(JSON.parse(decryptedPayload));

    } catch (error) { 
        res.status(500).json({ error: error.toString() }); 
    } finally { 
        if (gateway) gateway.disconnect(); 
    }
});

// =================================================================
// KHỞI ĐỘNG SERVER
// =================================================================
app.listen(PORT, HOST, () => {
    console.log(`--- Khởi động API Gateway V3.0 (Hybrid-Encryption) ---`);
    console.log(`Đang lắng nghe trên http://${HOST}:${PORT}`);
});
