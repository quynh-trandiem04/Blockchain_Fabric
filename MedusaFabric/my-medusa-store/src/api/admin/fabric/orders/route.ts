// src\api\admin\fabric\orders\route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MedusaError } from "@medusajs/utils";
import jwt from "jsonwebtoken";
import { Modules } from "@medusajs/utils";

const FabricService = require("../../../../services/fabric"); 
const fabricService = new FabricService(); 

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// CHỈ CHO PHÉP ADMIN (SÀN TMĐT) TẠO ĐƠN
const CREATE_ALLOWED_ROLES = ['ecommerceplatformorgmsp'];

// Hàm xác định vai trò (Dùng lại logic chuẩn)
const getFabricRole = (userData: any): string => {
  const customRole = userData.metadata?.fabric_role || userData.metadata?.role; 
  if (customRole) return customRole.toLowerCase();
  // Fallback cho Admin
  if (userData.email && (userData.email.includes('admin') || userData.email.includes('thuquynh'))) return 'ecommerceplatformorgmsp'; 
  return 'none';
};

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const orderData = req.body as any; 

  // =================================================================
  // BƯỚC 1: XÁC THỰC & PHÂN QUYỀN (RBAC)
  // =================================================================
  
  // A. Lấy Token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "UNAUTHORIZED: Thiếu Bearer Token." });
  }
  const token = authHeader.split(" ")[1];
  let actorId: string;

  try {
      // B. Giải mã Token
      const decoded: any = jwt.verify(token, JWT_SECRET);
      actorId = decoded.actor_id || decoded.user_id;
  } catch (err) {
      return res.status(401).json({ error: "UNAUTHORIZED: Token không hợp lệ." });
  }

  try {
      // C. Lấy User từ DB
      const userModuleService: any = req.scope.resolve(Modules.USER);
      const user = await userModuleService.retrieveUser(actorId, {
          select: ["id", "email", "metadata"]
      });

      if (!user) return res.status(401).json({ error: "UNAUTHORIZED: User không tồn tại." });

      // D. Kiểm tra Quyền (Chỉ Admin được tạo)
      const callingRole = getFabricRole(user);
      console.log(`[CREATE ORDER CHECK] User: ${user.email} | Role: ${callingRole}`);

      if (!CREATE_ALLOWED_ROLES.includes(callingRole)) {
          return res.status(403).json({ 
              error: `FORBIDDEN: Tài khoản ${callingRole} không có quyền TẠO đơn hàng lên Blockchain.` 
          });
      }

      // =================================================================
      // BƯỚC 2: THỰC THI GIAO DỊCH (NẾU QUYỀN HỢP LỆ)
      // =================================================================

      if (!orderData.orderID || !orderData.sellerID) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, "Thiếu OrderID hoặc SellerID.");
      }

      console.log("Processing Fabric Order:", orderData.orderID);
      
      const txId = await fabricService.createOrder(orderData);

      res.json({
        message: "Giao dịch Fabric thành công!",
        tx_id: txId,
      });

  } catch (error: any) { 
    console.error("FABRIC ERROR:", error);
    res.status(500).json({ 
      error: error.message || "Fabric transaction failed." 
    });
  }
};