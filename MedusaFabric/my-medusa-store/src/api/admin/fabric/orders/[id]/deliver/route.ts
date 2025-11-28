// src/api/admin/fabric/orders/[id]/deliver/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";
import jwt from "jsonwebtoken";

const FabricService = require("../../../../../../services/fabric");
const fabricService = new FabricService();

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const ALLOWED_ROLES = ['shipperorgmsp'];

type MedusaAuthenticatedRequest = MedusaRequest & {
  auth_context?: { actor_id: string; };
};

export const POST = async (req: MedusaAuthenticatedRequest, res: MedusaResponse) => {
  const { id } = req.params;
  let actorId: string | undefined;

  if (req.auth_context?.actor_id) actorId = req.auth_context.actor_id;
  else if ((req as any).auth?.actor_id) actorId = (req as any).auth.actor_id;

  if (!actorId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
          try {
             const decoded: any = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
             actorId = decoded.actor_id || decoded.user_id;
          } catch (e) {}
      }
  }

  if (!actorId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const userModuleService: any = req.scope.resolve(Modules.USER);
    const user = await userModuleService.retrieveUser(actorId, { select: ["id", "metadata", "email"] });
    const role = (user.metadata?.fabric_role as string || "").toLowerCase();
    
    if (!ALLOWED_ROLES.includes(role)) {
        return res.status(403).json({ error: "Chỉ Shipper mới được xác nhận giao hàng." });
    }

    console.log(`[API] ConfirmDelivery for ${id} by ${user.email}`);
    const txId = await fabricService.confirmDelivery(id);

    res.json({ message: "Giao hàng thành công!", tx_id: txId });

  } catch (error: any) {
    console.error("DELIVERY ERROR:", error);
    res.status(500).json({ error: error.message || "Lỗi hệ thống." });
  }
};