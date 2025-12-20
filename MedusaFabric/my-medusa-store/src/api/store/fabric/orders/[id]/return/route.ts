// src/api/store/fabric/orders/[id]/return/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";

// Import Service
const FabricService = require("../../../../../../services/fabric");

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params; // Đây là sub-order ID (VD: order_..._1)
  
  // Khởi tạo Service
  const fabricService = new FabricService(req.scope);

  try {
    console.log(`[API] Processing Return Request for: ${id}`);

    // Gọi hàm requestReturn trong service (Hàm này đã dùng identity 'admin' như cấu hình cũ)
    await fabricService.requestReturn(id);

    return res.json({
      success: true,
      message: "Yêu cầu trả hàng đã được gửi thành công!",
    });

  } catch (error: any) {
    console.error("RETURN ERROR:", error);
    
    // Xử lý thông báo lỗi từ Chaincode (VD: Quá hạn 5 phút)
    // Chaincode trả về: "đã quá 7 ngày..."
    let errorMessage = error.message || "Lỗi hệ thống.";
    
    if (errorMessage.includes("đã quá")) {
        return res.status(400).json({ error: "Đã hết thời hạn đổi trả (5 phút demo)." });
    }
    
    if (errorMessage.includes("DELIVERED")) {
        return res.status(400).json({ error: "Đơn hàng chưa giao thành công, không thể trả." });
    }

    return res.status(500).json({ error: errorMessage });
  }
};

// CORS OPTIONS
export async function OPTIONS(req: MedusaRequest, res: MedusaResponse) {
  const origin = (req.headers["origin"] as string) || "*";
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-publishable-api-key",
      "Access-Control-Allow-Credentials": "true", 
    },
  });
}