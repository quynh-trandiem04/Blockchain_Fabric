// src/api/admin/fabric/orders/[id]/remit/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";

// Import Service (Admin dùng chung service fabric nhưng với quyền Admin)
const FabricService = require("../../../../../../services/fabric");

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params;
  const fabricService = new FabricService(req.scope);

  try {
    // 1. (Opsional) Check quyền Admin Medusa ở đây nếu cần
    // Middleware của Medusa thường đã bảo vệ route /admin/* rồi

    // 2. Gọi Fabric
    // Lưu ý: Hàm remitCOD trong fabric.ts sẽ dùng identity 'admin' (của Sàn)
    console.log(`[Admin API] Confirming COD Remittance for order: ${id}`);
    
    await fabricService.remitCOD(id);

    return res.json({
      success: true,
      message: "Đã xác nhận nhận tiền COD thành công (Remitted)!",
    });

  } catch (error: any) {
    console.error("REMIT COD ERROR:", error);
    return res.status(500).json({ 
        message: error.message || "Lỗi hệ thống.",
        details: error.responses ? error.responses : undefined
    });
  }
};

// Handle CORS cho Admin (nếu admin dashboard chạy port khác)
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