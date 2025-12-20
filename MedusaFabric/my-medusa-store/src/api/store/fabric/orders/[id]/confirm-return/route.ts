// src/api/store/fabric/orders/[id]/confirm-return/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";
import jwt from "jsonwebtoken";

const FabricService = require("../../../../../../services/fabric");
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const ALLOWED_ROLES = ['sellerorgmsp'];

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params;
  const fabricService = new FabricService(req.scope);

  try {
    // 1. Auth Check
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) return res.status(401).json({ message: "Missing Token" });
    const token = authHeader.split(" ")[1];
    
    let actorId = "";
    try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        actorId = decoded.actor_id || decoded.user_id;
    } catch (e) { return res.status(401).json({ message: "Invalid Token" }); }

    // 2. Get Seller Info
    const userModuleService = req.scope.resolve(Modules.USER);
    const user = await userModuleService.retrieveUser(actorId, { select: ["id", "metadata", "email"] });
    const role = (user.metadata?.fabric_role as string || "").toLowerCase();
    const companyCode = user.metadata?.company_code as string;

    if (!ALLOWED_ROLES.includes(role)) return res.status(403).json({ message: "Forbidden: Chỉ Seller mới được quyền này." });
    if (!companyCode) return res.status(400).json({ message: "Missing Company Code" });

    // 3. Call Fabric
    console.log(`[API] ConfirmReturn for ${id} by Seller: ${companyCode}`);
    await fabricService.confirmReturnReceived(id, companyCode);

    return res.json({ success: true, message: "Đã xác nhận nhận lại hàng hoàn thành công!" });

  } catch (error: any) {
    console.error("CONFIRM RETURN ERROR:", error);
    return res.status(500).json({ message: error.message || "Lỗi hệ thống" });
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