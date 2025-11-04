'use strict';

const express = require('express');
const cors = require('cors');
const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml'); // <-- THÊM DÒNG NÀY

// === Cấu hình ===
const app = express();
const PORT = 5001;
const HOST = '0.0.0.0';
const CHANNEL_NAME = 'orderchannel';
const CC_NAME = 'ecommerce';

app.use(cors());
app.use(express.json());

// Hàm helper để kết nối Gateway
async function getGatewayContract() {
    // Tải connection profile
    const ccpPath = path.resolve(__dirname, 'connection-profile.yaml');
    
    // --- SỬA LỖI: Dùng yaml.load thay vì JSON.parse ---
    const ccp = yaml.load(fs.readFileSync(ccpPath, 'utf8'));
    // ---------------------------------------------

    // Tải wallet
    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = await Wallets.newFileSystemWallet(walletPath);

    // Kiểm tra xem có danh tính 'admin' không
    const identity = await wallet.get('admin');
    if (!identity) {
        throw new Error('Danh tính "admin" không tìm thấy. Hãy chạy enrollAdmin.js');
    }

    // Tạo kết nối gateway
    const gateway = new Gateway();
    await gateway.connect(ccp, {
        wallet,
        identity: 'admin',
        discovery: { enabled: true, asLocalhost: true }
    });

    // Lấy network và contract
    const network = await gateway.getNetwork(CHANNEL_NAME);
    const contract = network.getContract(CC_NAME);

    return { gateway, contract };
}

// === Định nghĩa API Endpoints ===

app.get('/', (req, res) => { // Sửa lỗi: Đây là cú pháp Express
    res.send("Chào mừng đến với API Gateway (Node.js) của Mạng Blockchain TMĐT!");
});

// --- API Endpoint 1: TRUY VẤN (Đọc) ---
app.get('/api/queryOrder/:order_id', async (req, res) => {
    const orderId = req.params.order_id;
    console.log(`--- Nhận request [QueryOrder] cho ID: ${orderId} ---`);

    let gateway;
    try {
        const { gateway: gw, contract } = await getGatewayContract();
        gateway = gw;

        // Gọi hàm chaincode 'QueryOrder'
        const result = await contract.evaluateTransaction('QueryOrder', orderId);

        console.log(`--- Phản hồi Query: ${result.toString()} ---`);
        res.status(200).json(JSON.parse(result.toString()));
    } catch (error) {
        console.error(`Lỗi khi query: ${error}`);
        res.status(500).json({ error: error.toString() });
    } finally {
        if (gateway) {
            gateway.disconnect();
        }
    }
});

// --- API Endpoint 2: THỰC THI (Ghi) ---
app.post('/api/createOrder', async (req, res) => {
    console.log(`--- Nhận request [CreateOrder] với data: ${JSON.stringify(req.body)} ---`);
    
    let gateway;
    try {
        const { gateway: gw, contract } = await getGatewayContract();
        gateway = gw;

        // Lấy dữ liệu từ body
        const { orderID, paymentMethod, amount, sellerID, shipperID, customerID } = req.body;
        
        // Chuyển amount thành string (chaincode Go của chúng ta nhận string)
        const amountStr = String(amount);

        // Gọi hàm chaincode 'CreateOrder' (Submit)
        // SubmitTransaction sẽ gửi và chờ commit
        const result = await contract.submitTransaction(
            'CreateOrder',
            orderID,
            paymentMethod,
            amountStr,
            sellerID,
            shipperID,
            customerID
        );

        // SDK 2.x thường trả về buffer rỗng khi thành công
        const txId = result.toString(); 
        console.log(`--- Phản hồi Invoke (TxID có thể rỗng): ${txId} ---`);
        res.status(200).json({ message: 'Giao dịch CreateOrder thành công!', tx_id: txId });
    } catch (error) {
        console.error(`Lỗi khi invoke: ${error}`);
        // Lỗi từ chaincode sẽ nằm trong error.message
        res.status(500).json({ error: error.toString() });
    } finally {
        if (gateway) {
            gateway.disconnect();
        }
    }
});

// === Khởi động Server ===
app.listen(PORT, HOST, () => {
    console.log(`--- Khởi động API Gateway (Node.js) ---`);
    console.log(`Đang lắng nghe trên http://${HOST}:${PORT}`);
});
