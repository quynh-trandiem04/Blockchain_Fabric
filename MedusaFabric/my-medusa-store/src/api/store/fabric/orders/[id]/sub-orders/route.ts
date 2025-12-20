// src/api/store/fabric/orders/[id]/sub-orders/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";

// Import Service
const FabricService = require("../../../../../../services/fabric");

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params; // Đây là ID gốc (ví dụ: order_01...)
  
  try {
    const fabricService = new FabricService(req.scope);
    
    // Gọi hàm mới vừa viết
    const subOrders = await fabricService.getSubOrders(id);

    // Trả về mảng các đơn con
    res.json({
        original_id: id,
        count: subOrders.length,
        sub_orders: subOrders
    });

  } catch (error: any) {
    console.error("SUB-ORDER API ERROR:", error);
    res.status(500).json({ error: "Lỗi lấy dữ liệu Blockchain" });
  }
};

// CORS OPTIONS (Bắt buộc cho Storefront)
export async function OPTIONS(req: MedusaRequest, res: MedusaResponse) {
  const origin = (req.headers["origin"] as string) || "*";
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-publishable-api-key",
      "Access-Control-Allow-Credentials": "true", 
    },
  });
}