// src/scripts/test-fabric-debug.js
require('dotenv').config();
const FabricService = require('../services/fabric');
const fs = require('fs');
const path = require('path');

// Mock container
const mockContainer = { resolve: (name) => ({}) };

async function main() {
    console.log("DEBUGGING FABRIC TRANSACTION...");
    try {
        const fabricService = new FabricService(mockContainer);
        
        // 1. Thử kết nối Gateway
        console.log("1. Connecting Gateway as 'seller_admin'...");
        const { contract, gateway } = await fabricService._getContract('seller');
        console.log("Gateway Connected.");

    // [MỚI] Đọc file Key RSA vừa tạo
    const sellerPubPath = path.join(process.cwd(), 'keys', 'seller_public_key.pem');
    let sellerPubKey = "";
        try {
        sellerPubKey = fs.readFileSync(sellerPubPath, 'utf8');
            console.log("Dã đọc Seller Public Key thành công.");
        } catch (e) {
            console.error("LỗI: Không tìm thấy file 'keys/seller_public_key.pem'. Hãy kiểm tra lại thư mục keys.");
        return;
        }

    // Tạo dữ liệu Order với Key thật
        const dummyOrder = {
            orderID: "ORDER_TEST_" + Date.now(),
            paymentMethod: "COD",
        shipperCompanyID: "GHN", 
        _sellerPublicKey: sellerPubKey, // <--- Đưa Key thật vào đây
            product_lines: [{ name: "Ao thun", quantity: 2 }],
            amount_untaxed: 100,
            amount_total: 110,
            shipping_address: "Test Address",
            shipping_phone: "0999999999"
        };
        
        // Gọi hàm createOrder của service
        await fabricService.createOrder(dummyOrder);
        console.log("Submit Success!");

        gateway.disconnect();

    } catch (error) {
        console.error("\nTRANSACTION FAILED - DETAILED LOGS:");
        
        // IN CHI TIẾT LỖI TỪ PEER
        if (error.responses) {
            console.error("--- PEER RESPONSES ---");
            error.responses.forEach(r => {
                console.error(`Peer: ${r.peer ? r.peer.name : 'Unknown'}`);
                console.error(`Status: ${r.status}`);
                console.error(`Message: ${r.message}`); // <--- Đây là nguyên nhân gốc
                console.error(`Is Endorsed: ${r.endorsement ? 'Yes' : 'No'}`);
            });
        } else {
            console.error("Error:", error.message);
            console.error("Stack:", error.stack);
        }
    }
}

main();