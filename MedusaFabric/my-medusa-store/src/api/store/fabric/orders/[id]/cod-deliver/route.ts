// my-medusa-store\src\api\store\fabric\orders\[id]\cod-deliver\route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";
import jwt from "jsonwebtoken";

const FabricService = require("../../../../../../services/fabric");

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const ALLOWED_ROLES = ['shipperorgmsp'];

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params;
  const fabricService = new FabricService(req.scope);

  try {
    // 1. Auth Check
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

    // 2. Get User & Company Code
    const userModuleService = req.scope.resolve(Modules.USER);
    const user = await userModuleService.retrieveUser(actorId, { 
        select: ["id", "metadata", "email"] 
    });

    const role = (user.metadata?.fabric_role as string || "").toLowerCase();
    const companyCode = user.metadata?.company_code as string;

    if (!ALLOWED_ROLES.includes(role)) {
        return res.status(403).json({ message: "Forbidden: Chỉ Shipper mới được xác nhận giao hàng." });
    }

    if (!companyCode) {
        return res.status(400).json({ message: "Lỗi: Tài khoản Shipper thiếu mã công ty." });
    }

    // 3. Call Fabric (Confirm COD Delivery)
    console.log(`[API] Confirm COD Delivery for ${id} | By: ${user.email} | Org: ${companyCode}`);
    
    // 🔥 Gọi hàm confirmCODDelivery
    await fabricService.confirmCODDelivery(id, companyCode);

    res.json({ 
        success: true,
        message: "Giao hàng & Thu tiền thành công! (COD)" 
    });

  } catch (error: any) {
    console.error("COD DELIVERY ERROR:", error);
    res.status(500).json({ message: error.message || "Lỗi hệ thống." });
  }
};

// CORS OPTIONS
export async function OPTIONS(req: MedusaRequest, res: MedusaResponse) {
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