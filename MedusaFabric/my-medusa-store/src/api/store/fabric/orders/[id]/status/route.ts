// src/api/store/fabric/orders/[id]/status/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";

// Import class FabricService
const FabricService = require("../../../../../../services/fabric");

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params;
  
  console.log(`[Store API] Request Status for Order ID: ${id}`);

  try {
    // 1. Khởi tạo Service (Bọc trong try-catch để bắt lỗi khởi tạo)
    let fabricService;
    try {
        // Truyền container (req.scope) vào constructor
        fabricService = new FabricService(req.scope);
    } catch (initError: any) {
      console.error("[Store API] Failed to init FabricService:", initError.message);
        return res.status(500).json({ error: "Service Initialization Failed" });
    }

    // 2. Gọi Blockchain
    console.log("   [Store API] Querying blockchain...");
    const orderData = await fabricService.queryOrder(id);

    if (!orderData || !orderData.status) {
      console.warn(`[Store API] Order ${id} not found/synced`);
        // Trả về 404 để Frontend biết là "Chưa đồng bộ" thay vì lỗi hệ thống
        return res.status(404).json({ message: "Not synced yet" });
    }

    console.log(`[Store API] Status found: ${orderData.status}`);

    // 3. Trả về kết quả
    res.json({
        status: orderData.status,
        paymentMethod: orderData.paymentMethod,
        updatedAt: orderData.updatedAt || orderData.UpdatedAt || orderData.timestamp,
        deliveryTimestamp: orderData.deliveryTimestamp
    });

  } catch (error: any) {
    console.error("[Store API] Query Error:", error.message);
    
    // Phân loại lỗi để trả về status code phù hợp
    if (error.message && (error.message.includes("does not exist") || error.message.includes("không tồn tại"))) {
         return res.status(404).json({ message: "Order not on blockchain" });
    }
    
    // Trả về 500 cho các lỗi khác
    res.status(500).json({ error: "Internal Server Error: " + error.message });
  }
};