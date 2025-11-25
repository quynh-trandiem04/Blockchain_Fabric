// src/api/admin/fabric/orders/[id]/confirm-payment/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";
import jwt from "jsonwebtoken";

// Import Service (đảm bảo đường dẫn đúng với cấu trúc dự án của bạn)
const FabricService = require("../../../../../../services/fabric");
const fabricService = new FabricService();

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
// Role được phép xác nhận thanh toán
const ALLOWED_ROLES = ['ecommerceplatformorgmsp'];

// --- 1. ĐỊNH NGHĨA TYPE MỞ RỘNG ĐỂ FIX LỖI TYPESCRIPT ---
type MedusaAuthenticatedRequest = MedusaRequest & {
  auth_context?: {
    actor_id: string;
  };
};

// --- 2. HÀM CHECK ROLE MỚI (CHỈ DỰA VÀO METADATA) ---
const getFabricRole = (userData: any): string => {
  // Lấy role từ metadata
  const customRole = userData.metadata?.fabric_role;
  console.log("Detected Fabric Role from Metadata:", customRole);
  if (customRole) {
      return customRole.toLowerCase();
  }

  return 'none';
};

export const POST = async (req: MedusaAuthenticatedRequest, res: MedusaResponse) => {
  const { id } = req.params;

  // =================================================================
  // BƯỚC 1: XÁC THỰC USER (LẤY ACTOR ID)
  // =================================================================
  let actorId: string | undefined;

  // A. Lấy từ Session Cookie (Ưu tiên, dùng cho Widget Admin)
  if (req.auth_context && req.auth_context.actor_id) {
      actorId = req.auth_context.actor_id;
      console.log("✅ Actor ID found in Auth Context (Session):", actorId);
  } 
  // Fallback: Kiểm tra req.auth (nếu dùng middleware cũ)
  else if ((req as any).auth?.actor_id) {
      actorId = (req as any).auth.actor_id;
  }

  // B. Lấy từ Bearer Token (Dùng cho Postman / External App)
  if (!actorId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
          try {
              const token = authHeader.split(" ")[1];
              const decoded: any = jwt.verify(token, JWT_SECRET);
              actorId = decoded.actor_id || decoded.user_id;
              console.log("✅ Actor ID found in Token:", actorId);
          } catch (err) {
              console.log("❌ Invalid Token check");
          }
      }
  }

  if (!actorId) {
      return res.status(401).json({ error: "UNAUTHORIZED: Không tìm thấy phiên đăng nhập." });
  }

  try {
    // =================================================================
    // BƯỚC 2: KIỂM TRA ROLE TRONG DB (LOGIC MỚI)
    // =================================================================
    const userModuleService: any = req.scope.resolve(Modules.USER);
    
    // Lấy user kèm metadata
    const user = await userModuleService.retrieveUser(actorId, {
        select: ["id", "email", "metadata"]
    });

    if (!user) {
        return res.status(401).json({ error: "User không tồn tại." });
    }

    const userRole = getFabricRole(user);
    console.log(`[Confirm Payment] User: ${user.email} | Detected Role: ${userRole}`);

    // So sánh role tìm được với danh sách cho phép
    if (!ALLOWED_ROLES.includes(userRole)) {
        return res.status(403).json({
            error: `FORBIDDEN: Role của bạn là '${userRole}'. Chỉ 'ecommerceplatformorgmsp' mới được xác nhận thanh toán.`
        });
    }

    // =================================================================
    // BƯỚC 3: GỌI BLOCKCHAIN
    // =================================================================
    console.log(`[Confirm Payment] Role Valid. Processing Order: ${id}`);
    
    const txId = await fabricService.confirmPayment(id);

    res.json({
      message: "Xác nhận thanh toán thành công!",
      tx_id: txId,
    });

  } catch (error: any) {
    console.error("CONFIRM PAYMENT ERROR:", error);
    res.status(500).json({
        error: error.message || "Lỗi khi xác nhận thanh toán."
    });
  }
};