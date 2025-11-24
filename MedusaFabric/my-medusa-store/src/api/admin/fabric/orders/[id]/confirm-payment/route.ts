// src/api/admin/fabric/orders/[id]/confirm-payment/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";
import jwt from "jsonwebtoken";

const FabricService = require("../../../../../../services/fabric");
const fabricService = new FabricService();

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
// Chỉ cho phép role này xác nhận thanh toán
const ALLOWED_ROLES = ['ecommerceplatformorgmsp'];

const getFabricRole = (userData: any): string => {
  const customRole = userData.metadata?.fabric_role || userData.metadata?.role;
  if (customRole) return customRole.toLowerCase();
  if (userData.email && (userData.email.includes('admin') || userData.email.includes('thuquynh'))) return 'ecommerceplatformorgmsp';
  return 'none';
};

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params;

  // 1. XÁC THỰC USER (Authentication & Authorization)
  let actorId: string | undefined;

  // Cách A: Lấy từ Session (nếu gọi từ Browser Admin)
  const authContext = (req as any).auth;
  if (authContext && authContext.actor_id) {
      actorId = authContext.actor_id;
  }
  console.log("Actor ID from session:", actorId);
  // Cách B: Lấy từ Bearer Token (nếu gọi từ Postman/Client khác)
  if (!actorId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
          try {
              const token = authHeader.split(" ")[1];
              const decoded: any = jwt.verify(token, JWT_SECRET);
              actorId = decoded.actor_id || decoded.user_id;
          } catch (err) {}
      }
  }
  console.log("Actor ID from token:", actorId);
  if (!actorId) {
      return res.status(401).json({ error: "UNAUTHORIZED: Không tìm thấy thông tin người dùng." });
  }

  try {
    // 2. KIỂM TRA ROLE TRONG DB
    const userModuleService: any = req.scope.resolve(Modules.USER);
    const user = await userModuleService.retrieveUser(actorId, {
        select: ["id", "email", "metadata"]
    });

    const userRole = getFabricRole(user);
    console.log(`[Confirm Payment] User: ${user.email} | Role: ${userRole}`);

    if (!ALLOWED_ROLES.includes(userRole)) {
        return res.status(403).json({
            error: `FORBIDDEN: Bạn là '${userRole}', chỉ 'ECommercePlatformOrgMSP' mới được xác nhận thanh toán.`
        });
    }

    // 3. GỌI BLOCKCHAIN
    console.log(`[Confirm Payment] Request received for Order: ${id}`);
    const txId = await fabricService.confirmPayment(id);

    res.json({
      message: "Xác nhận thanh toán thành công!",
      tx_id: txId,
    });

  } catch (error: any) {
    console.error("CONFIRM PAYMENT ERROR:", error);
    // Xử lý lỗi từ Smart Contract trả về (ví dụ: Order không phải PREPAID)
    res.status(500).json({
        error: error.message || "Lỗi khi xác nhận thanh toán."
    });
  }
};