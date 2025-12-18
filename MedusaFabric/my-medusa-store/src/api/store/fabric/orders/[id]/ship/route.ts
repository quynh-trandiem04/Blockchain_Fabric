// src/api/store/fabric/orders/[id]/ship/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";
import jwt from "jsonwebtoken";

const FabricService = require("../../../../../../services/fabric");

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const ALLOWED_ROLES = ['shipperorgmsp'];

// --- POST HANDLER ---
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params;
  
  // 1. Khởi tạo Service với Scope
  const fabricService = new FabricService(req.scope);

  try {
    // 2. Kiểm tra Token (Authentication)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized: Missing Token" });
    }

    const token = authHeader.split(" ")[1];
    let actorId = "";
    
    try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        actorId = decoded.actor_id || decoded.user_id;
    } catch (e) {
        return res.status(401).json({ message: "Unauthorized: Invalid Token" });
    }

    if (!actorId) return res.status(401).json({ message: "Unauthorized: No Actor ID" });

    // 3. Lấy thông tin User từ Database Medusa
    const userModuleService = req.scope.resolve(Modules.USER);
    const user = await userModuleService.retrieveUser(actorId, { 
        select: ["id", "metadata", "email"] 
    });

    const role = (user.metadata?.fabric_role as string || "").toLowerCase();
    const companyCode = user.metadata?.company_code as string;

    // 4. Kiểm tra Quyền (Authorization)
    if (!ALLOWED_ROLES.includes(role)) {
        return res.status(403).json({ message: "Forbidden: Chỉ tài khoản Shipper mới được quyền giao hàng." });
    }
    
    if (!companyCode) {
        return res.status(400).json({ message: "Lỗi dữ liệu: Tài khoản Shipper này chưa có mã công ty (company_code)." });
    }

    // 5. Gọi Blockchain
    console.log(`[API] Processing ShipOrder for ${id}`);
    console.log(`      -> Actor: ${user.email}`);
    console.log(`      -> Verification Company Code: ${companyCode}`);

    await fabricService.shipOrder(id, companyCode);

    return res.json({
      success: true,
      message: "Đã xác nhận lấy hàng thành công (Shipped)!",
    });

  } catch (error: any) {
    console.error("SHIP ORDER ERROR:", error);
    
    // Xử lý lỗi trả về từ Fabric để hiển thị rõ ràng hơn cho Frontend
    const errorMessage = error.message || "Lỗi hệ thống khi giao hàng.";
    
    return res.status(500).json({ 
        message: errorMessage,
        details: error.responses ? error.responses : undefined
    });
  }
};

// --- OPTIONS HANDLER (FIX CORS & TYPESCRIPT) ---
export async function OPTIONS(req: MedusaRequest, res: MedusaResponse) {
  // Lấy origin từ request header để trả về chính xác
  // Ép kiểu (as string) để tránh lỗi TypeScript: "Type 'string | string[]' is not assignable..."
  const origin = (req.headers["origin"] as string) || "*";

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-publishable-api-key, X-Requested-With",
      "Access-Control-Allow-Credentials": "true", 
    },
  });
}