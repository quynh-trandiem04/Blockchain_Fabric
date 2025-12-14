// src/api/store/test-fabric/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
const FabricService = require("../../../services/fabric"); // Đảm bảo đường dẫn đúng tới file fabric.js

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  console.log("🧪 [API TEST] Starting Fabric Connection Test...");
  
  const container = req.scope;
  const fabricService = new FabricService(container);

  try {
    // 1. Tạo dữ liệu giả lập (Dummy Data)
    // Dữ liệu này giống hệt dữ liệu mà Subscriber gửi đi
    const dummyPayload = {
      orderID: `TEST_ORDER_${Date.now()}`, // Tạo ID ngẫu nhiên để không trùng
      paymentMethod: "COD",
      sellerCompanyID: "Shop_1765626220840", // ID Shop thật lấy từ log cũ của bạn
      shipperCompanyID: "GHN",
      
      customerName: "Test User",
      shipping_address: "123 Test Street, Hanoi",
      shipping_phone: "0987654321",
      
      product_lines: [
        {
          product_name: "Test Product A",
          quantity: 2,
          unit_price: 100,
          subtotal: 200
        }
      ],
      
      amount_untaxed: 200,
      amount_total: 220,
      shipping_total: 20,
      cod_amount: 220,

      // Key giả để test (Vì mã hóa cần key thật, nhưng ở đây ta test kết nối là chính)
      // Nếu bạn muốn test full luồng mã hóa, hãy đảm bảo Shop ID ở trên có trong DB và có Key
      // Hoặc hardcode key public vào đây nếu cần.
      _sellerPublicKey: "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAob/ou8yhcq4h2vPLwi/K\nznQZZ4Dol9qlHS85p0dXtQTr6mjJ3swbXcPKR61dLiLNVCq7QLWm0x8iki0NbYEt\nZVVNmfKXWIgZNWwNQLgmuRJjZp8GPa+nSj67CcDEbL7sD5LNShRZGG81Siisos5a\nzaUyLvAtIyikwpakLTE7e/36YSWvWUNWsyre/7R3OmZ4wzOKBGW1m6PPUvFuGrXp\nXjmiyzL87Nppuf/kZF0D9n8ZNOQLzW+b0UR+hx90xHrNgm8wNplmv2MtYph2LrwR\nEWAlk5iYYcN0+zoS0Y5bnh+HvAUVsNYhXWXkNHrCG7m7s1qrzuspReNu5/jcDNs9\nfQIDAQAB\n-----END PUBLIC KEY-----" 
    };

    console.log(`🧪 [API TEST] Payload created: ${dummyPayload.orderID}`);

    // 2. Gọi hàm createOrder trực tiếp
    const txId = await fabricService.createOrder(dummyPayload);

    console.log(`✅ [API TEST] Success! TX ID: ${txId}`);

    // 3. Trả về kết quả cho Postman
    res.status(200).json({
      message: "Fabric Connection Successful",
      transaction_id: txId,
      order_id: dummyPayload.orderID
    });

  } catch (error: any) {
    console.error("❌ [API TEST] Failed:", error);
    res.status(500).json({
      message: "Fabric Connection Failed",
      error: error.message,
      stack: error.stack
    });
  }
};