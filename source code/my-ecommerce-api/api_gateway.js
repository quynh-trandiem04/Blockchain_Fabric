'use strict';
const express = require('express');
const cors = require('cors');
const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const crypto = require('crypto'); // Thư viện mã hóa

// =================================================================
// CẤU HÌNH CƠ BẢN
// =================================================================
const app = express();
const PORT = 5001;
const HOST = '0.0.0.0';
const CHANNEL_NAME = 'orderchannel'; // Kênh
const CC_NAME = 'ecommerce'; // Tên chaincode

app.use(cors());
app.use(express.json()); // Middleware để parse JSON body

// =================================================================
// TẢI CÁC KHÓA MÃ HÓA (RSA KEYS)
// =================================================================
const KEY_PATH = path.resolve(__dirname, 'keys');
let SELLER_PUBLIC_KEY, SHIPPER_PUBLIC_KEY, SELLER_PRIVATE_KEY, SHIPPER_PRIVATE_KEY;

try {
    SELLER_PUBLIC_KEY = fs.readFileSync(path.join(KEY_PATH, 'seller_public_key.pem'), 'utf8');
    SHIPPER_PUBLIC_KEY = fs.readFileSync(path.join(KEY_PATH, 'shipper_public_key.pem'), 'utf8');
    // (Khóa riêng chỉ dùng cho demo giải mã)
    SELLER_PRIVATE_KEY = fs.readFileSync(path.join(KEY_PATH, 'seller_private_key.pem'), 'utf8');
    SHIPPER_PRIVATE_KEY = fs.readFileSync(path.join(KEY_PATH, 'shipper_private_key.pem'), 'utf8');
} catch (e) {
    console.error("LỖI NGHIÊM TRỌNG: Không thể tải file khóa. Hãy chạy 'openssl' để tạo 4 file .pem trong thư mục 'keys'.");
    process.exit(1);
}

// =================================================================
// CÁC HÀM HELPER (Mã hóa / Giải mã / Kết nối)
// =================================================================
const ALGORITHM = 'aes-256-gcm'; // Thuật toán mã hóa đối xứng
const IV_LENGTH = 16; // Kích thước của Initialization Vector
const KEY_LENGTH = 32; // Kích thước khóa (AES-256 = 32 bytes)
const AUTH_TAG_LENGTH = 16; // Kích thước của Auth Tag (cho GCM)

/**
 * Mã hóa Lai (Hybrid Encryption).
 * 1. Tạo khóa AES ngẫu nhiên.
 * 2. Dùng AES mã hóa dữ liệu (payload).
 * 3. Dùng RSA (public key) mã hóa khóa AES.
 * 4. Trả về 1 JSON blob chứa tất cả (IV, authTag, encryptedKey, encryptedData).
 */
function hybridEncrypt(dataString, rsaPublicKey) {
    // 1. Tạo khóa AES và IV ngẫu nhiên
    const symmetricKey = crypto.randomBytes(KEY_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // 2. Dùng AES-256-GCM để mã hóa dữ liệu lớn
    const cipher = crypto.createCipheriv(ALGORITHM, symmetricKey, iv);
    let encryptedData = cipher.update(dataString, 'utf8', 'base64');
    encryptedData += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    // 3. Dùng RSA (public key) để mã hóa khóa AES
    const encryptedKey = crypto.publicEncrypt(
        {
            key: rsaPublicKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256',
        },
        symmetricKey // Mã hóa khóa AES (32 bytes), không phải dữ liệu
    );

    // 4. Trả về 1 JSON blob (dưới dạng string)
    return JSON.stringify({
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        encryptedKey: encryptedKey.toString('base64'),
        encryptedData: encryptedData
    });
}

/**
 * Giải mã Lai (Hybrid Decryption).
 * (Chỉ dùng cho demo).
 */
function hybridDecrypt(blobString, rsaPrivateKey) {
    // 1. Parse JSON blob
    const { iv, authTag, encryptedKey, encryptedData } = JSON.parse(blobString);
    const ivBuffer = Buffer.from(iv, 'base64');
    const authTagBuffer = Buffer.from(authTag, 'base64');

    // 2. Dùng RSA (private key) để giải mã khóa AES
    const decryptedSymmetricKey = crypto.privateDecrypt(
        {
            key: rsaPrivateKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256',
        },
        Buffer.from(encryptedKey, 'base64')
    );

    // 3. Dùng khóa AES vừa giải mã để giải mã dữ liệu lớn
    const decipher = crypto.createDecipheriv(ALGORITHM, decryptedSymmetricKey, ivBuffer);
    decipher.setAuthTag(authTagBuffer);
    let decryptedData = decipher.update(encryptedData, 'base64', 'utf8');
    decryptedData += decipher.final('utf8');

    return decryptedData; // Trả về JSON string gốc
}

/**
 * Hàm helper kết nối Gateway
 * [cite: 1890-1915]
 */
async function getGatewayContract() {
    // 1. Tải connection profile
    const ccpPath = path.resolve(__dirname, 'connection-profile.yaml');
    const ccp = yaml.load(fs.readFileSync(ccpPath, 'utf8'));

    // 2. Tải wallet
    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = await Wallets.newFileSystemWallet(walletPath);

    // 3. Kiểm tra danh tính 'admin' (đã tạo bằng enrollAdmin.js)
    const identity = await wallet.get('admin');
    if (!identity) {
        throw new Error('Danh tính "admin" không tìm thấy. Hãy chạy enrollAdmin.js');
    }

    // 4. Tạo kết nối gateway
    const gateway = new Gateway();
    // (Lưu ý: discovery.asLocalhost: true là cần thiết khi chạy trong Docker)
    await gateway.connect(ccp, {
        wallet,
        identity: 'admin',
        discovery: { enabled: false, asLocalhost: true }
    });

    // 5. Lấy network và contract
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
    console.log(`--- Nhận request [QueryOrder] cho ID: ${orderId} ---`);
    let gateway;
    try {
        const { gateway: gw, contract } = await getGatewayContract();
        gateway = gw;
        // 5. Gọi hàm 'CreateOrder' (Submit)
        console.log("Đang gửi 6 tham số (gồm 2 blob mã hóa) lên chaincode...");

        const transaction = contract.createTransaction('CreateOrder');
        
        // Chỉ định các peer từ 3 tổ chức khác nhau
        transaction.setEndorsingPeers([
            'peer0.ecommerce.com',
            'peer0.seller.com',
            'peer0.shipper.com'
        ]);

        // Gửi giao dịch với các tham số
        const result = await transaction.submit(...args);
        
        console.log(`--- Phản hồi Invoke (TxID): ${result.toString()} ---`);
        res.status(200).json({ message: 'Giao dịch CreateOrder thành công!', tx_id: result.toString() });
    } catch (error) {
        console.error(`Lỗi khi query: ${error}`);
        res.status(500).json({ error: error.toString() });
    } finally {
        if (gateway) gateway.disconnect();
    }
});


// --- API Endpoint 2: CREATE ORDER (Ghi) ---
app.post('/api/createOrder', async (req, res) => {
    console.log(`--- Nhận request [CreateOrder V3.1 - Hybrid] ---`);
    let gateway;
    try {
        const { gateway: gw, contract } = await getGatewayContract();
        gateway = gw;

        // 1. Lấy TẤT CẢ dữ liệu (plaintext + sensitive) từ Odoo
        const data = req.body;

        // 2. Chuẩn bị các gói dữ liệu riêng tư (dựa trên thiết kế V3.0)
        // (Odoo đã gửi các payload này)
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
        // Đây là giải pháp cho lỗi "data too large"
        const encryptedSellerBlob = hybridEncrypt(sellerPayload, SELLER_PUBLIC_KEY);
        const encryptedShipperBlob = hybridEncrypt(shipperPayload, SHIPPER_PUBLIC_KEY);

        // 4. Chuẩn bị 6 tham số CÔNG KHAI cho Chaincode V3.0
        const args = [
            data.orderID,
            data.paymentMethod,
            data.sellerID, // (Odoo gửi "SellerOrgMSP")
            data.shipperID, // (Odoo gửi "ShipperOrgMSP")
            encryptedSellerBlob,    // Tham số 5 (Blob 1 - Giờ là JSON blob)
            encryptedShipperBlob    // Tham số 6 (Blob 2 - Giờ là JSON blob)
        ];

        // 5. Gọi hàm 'CreateOrder' (Submit)
        console.log("Đang gửi 6 tham số (gồm 2 blob mã hóa lai) lên chaincode...");
        const result = await contract.submitTransaction('CreateOrder', ...args);
        
        console.log(`--- Phản hồi Invoke (TxID): ${result.toString()} ---`);
        res.status(200).json({ message: 'Giao dịch CreateOrder (V3.1) thành công!', tx_id: result.toString() });

    } catch (error) {
        console.error(`Lỗi khi invoke V3.1: ${error}`);
        res.status(500).json({ error: error.toString() });
    } finally {
        if (gateway) gateway.disconnect();
    }
});

// --- API Endpoints 3 -> 12: CÁC HÀM INVOKE KHÁC (Chỉ 1 tham số) ---

/**
 * Đây là một hàm "Factory" (nhà máy) để tạo nhanh các endpoint đơn giản
 * (như ConfirmPayment, CancelOrder, ShipOrder...)
 * mà chỉ cần 1 tham số là orderID.
 */
function createInvokeHandler(chaincodeFunction, successMessage) {
    return async (req, res) => {
        console.log(`--- Nhận request [${chaincodeFunction}] ---`);
        const { orderID } = req.body; // Các hàm này chỉ cần orderID
        if (!orderID) {
            return res.status(400).json({ error: "Thiếu 'orderID' trong body" });
        }
        
        let gateway;
        try {
            const { gateway: gw, contract } = await getGatewayContract();
            gateway = gw;
            
            console.log(`Đang gọi ${chaincodeFunction} cho ${orderID}...`);
            //const result = await contract.submitTransaction(chaincodeFunction, orderID);
            const transaction = contract.createTransaction(chaincodeFunction);
            
            // Giả định các hàm này cũng cần 3 chữ ký
            transaction.setEndorsingPeers([
                'peer0.ecommerce.com',
                'peer0.seller.com',
                'peer0.shipper.com'
            ]);
            
            const result = await transaction.submit(orderID);
            console.log(`--- Phản hồi Invoke (TxID): ${result.toString()} ---`);
            res.status(200).json({ message: successMessage, tx_id: result.toString() });
            
        } catch (error) {
            console.error(`Lỗi khi invoke ${chaincodeFunction}: ${error}`);
            // Lỗi từ chaincode (ví dụ: logic 7 ngày) sẽ nằm trong đây
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


// --- API DEMO GIẢI MÃ (Dùng để kiểm tra) ---
app.get('/api/decryptForSeller/:order_id', async (req, res) => {
    // ... (Code này mô phỏng client của Seller)
    const orderId = req.params.order_id;
    let gateway;
    try {
        const { gateway: gw, contract } = await getGatewayContract();
        gateway = gw;
        const result = await contract.evaluateTransaction('QueryOrder', orderId);
        const orderData = JSON.parse(result.toString());
        
        // Lấy blob JSON mã hóa từ chaincode
        const encryptedBlobString = orderData.seller_data_blob;
        if (!encryptedBlobString) {
            return res.status(404).json({error: "Không tìm thấy dữ liệu cho Seller"});
        }
        
        // Dùng Khóa RIÊNG của Seller để giải mã
        const decryptedPayload = hybridDecrypt(encryptedBlobString, SELLER_PRIVATE_KEY);
        
        res.status(200).json(JSON.parse(decryptedPayload)); // Trả về JSON đã giải mã

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
        
        const encryptedBlobString = orderData.shipper_data_blob; // Sửa tên trường
        if (!encryptedBlobString) {
            return res.status(404).json({error: "Không tìm thấy dữ liệu cho Shipper"});
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
    console.log("Đã tải 4 khóa RSA (Public/Private) cho Seller và Shipper.");
    console.log(`Chaincode: ${CC_NAME}, Kênh: ${CHANNEL_NAME}`);
});