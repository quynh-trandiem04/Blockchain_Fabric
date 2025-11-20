// src/api/admin/fabric/orders/[id]/decrypt/seller/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import jwt from "jsonwebtoken";
import { Modules } from "@medusajs/utils";

const FabricService = require("../../../../../../../services/fabric");
const fabricService = new FabricService();

const SELLER_ALLOWED_ROLES = ['sellerorgmsp', 'ecommerceplatformorgmsp'];
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

const getFabricRole = (userData: any): string => {
  const customRole = userData.metadata?.fabric_role || userData.metadata?.role; 
  if (customRole) return customRole.toLowerCase();
  if (userData.email && (userData.email.includes('admin') || userData.email.includes('thuquynh'))) return 'ecommerceplatformorgmsp'; 
  return 'none';
};

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const orderId = req.params.id;

  // 1. [MANUAL AUTH]
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "UNAUTHORIZED: Thiếu Bearer Token." });
  }
  const token = authHeader.split(" ")[1];

  let actorId: string;

  try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      actorId = decoded.actor_id || decoded.user_id;
      if (!actorId) throw new Error("Token không chứa Actor ID.");
  } catch (err) {
      return res.status(401).json({ error: "UNAUTHORIZED: Token không hợp lệ." });
  }

  try {
      // 2. LẤY USER TỪ DB
      const userModuleService: any = req.scope.resolve(Modules.USER);
      
      const user = await userModuleService.retrieveUser(actorId, {
          select: ["id", "email", "metadata"]
      });

      if (!user) {
          return res.status(401).json({ error: "UNAUTHORIZED: User không tồn tại." });
      }

      // 3. KIỂM TRA QUYỀN (RBAC)
      const callingRole = getFabricRole(user);
      console.log(`[RBAC Check] User: ${user.email} | Role: ${callingRole}`);

      if (!SELLER_ALLOWED_ROLES.includes(callingRole)) {
          return res.status(403).json({ 
              error: `FORBIDDEN: Tài khoản ${user.email} (${callingRole}) không có quyền giải mã dữ liệu Seller.` 
          });
      }

      // 4. GIẢI MÃ DỮ LIỆU
      const data = await fabricService.decryptSellerData(orderId);
      res.json(data);

  } catch (error: any) {
    console.error("ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};