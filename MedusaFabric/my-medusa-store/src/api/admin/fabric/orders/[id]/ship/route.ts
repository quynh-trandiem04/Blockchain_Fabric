// src/api/admin/fabric/orders/[id]/ship/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";
import jwt from "jsonwebtoken";

const FabricService = require("../../../../../../services/fabric");
const fabricService = new FabricService();

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
// Chỉ Seller được phép gọi
const ALLOWED_ROLES = ['sellerorgmsp'];

// --- 1. ĐỊNH NGHĨA TYPE MỞ RỘNG ---
type MedusaAuthenticatedRequest = MedusaRequest & {
  auth_context?: {
    actor_id: string;
  };
};

// --- 2. SỬ DỤNG TYPE MỚI CHO BIẾN 'req' ---
export const POST = async (req: MedusaAuthenticatedRequest, res: MedusaResponse) => {
  const { id } = req.params;

  // 1. LẤY ACTOR ID (User đang đăng nhập)
  let actorId: string | undefined;

  // Bây giờ TypeScript đã hiểu req.auth_context là gì, không còn báo đỏ nữa
  if (req.auth_context?.actor_id) {
      actorId = req.auth_context.actor_id;
  } 
  // Fallback kiểm tra kiểu cũ (dùng as any để bỏ qua check type)
  else if ((req as any).auth?.actor_id) {
      actorId = (req as any).auth.actor_id;
  }

  // Fallback cho Postman (Bearer Token)
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
    // 2. KIỂM TRA ROLE TRONG DATABASE
    const userModuleService: any = req.scope.resolve(Modules.USER);
    const user = await userModuleService.retrieveUser(actorId, { select: ["id", "metadata", "email"] });
    
    const role = (user.metadata?.fabric_role as string || "").toLowerCase();
    const email = (user.email || "").toLowerCase();
    
    // Check quyền: Seller
    const isAuthorized = ALLOWED_ROLES.includes(role);

    if (!isAuthorized) {
        return res.status(403).json({ error: "Chỉ Nhà bán (Seller) mới được quyền giao hàng." });
    }

    // 3. GỌI BLOCKCHAIN
    console.log(`[API] ShipOrder request for ${id} by ${user.email} (${role})`);
    const txId = await fabricService.shipOrder(id, role);

    res.json({
      message: "Đã bàn giao cho vận chuyển!",
      tx_id: txId
    });

  } catch (error: any) {
    console.error("SHIP ORDER ERROR:", error);
    // Trả về lỗi từ Blockchain (ví dụ: Trạng thái không hợp lệ)
    res.status(500).json({ error: error.message || "Lỗi hệ thống khi giao hàng." });
  }
};