// src/api/store/fabric/orders/[id]/decrypt/shipper/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import jwt from "jsonwebtoken";
import { Modules } from "@medusajs/utils";
import { Client } from "pg"; 

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const DB_URL = process.env.DATABASE_URL;

// Import FabricService
const FabricServiceClass = require("../../../../../../../services/fabric");

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const orderId = req.params.id; 
  console.log(`[Decrypt API - Shipper] 🔍 Attempting decrypt for Order: ${orderId}`);

  let actorId: string | undefined;
  let authIdentityId: string | undefined;

  // 1. LẤY ID TỪ AUTH CONTEXT
  const authContext = (req as any).auth_context; // Medusa v2 dùng auth_context
  if (authContext) {
      actorId = authContext.actor_id || authContext.user_id;
      authIdentityId = authContext.auth_identity_id;
  }

  // 2. TỰ LẤY ID TỪ TOKEN (Manual Fallback)
    if (!actorId) {
      const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
          try {
            const token = authHeader.split(" ")[1];
              const decoded: any = jwt.verify(token, JWT_SECRET);
              
              const resolvedId = decoded.actor_id || decoded.sub;
              if (resolvedId) actorId = resolvedId;
              
              authIdentityId = decoded.auth_identity_id; 
          } catch (err) {
              console.warn("[Decrypt API - Shipper] ⚠️ Token verification failed.");
          }
      }
  }

  // 3. TRA CỨU DB (Fallback cuối cùng)
  if (!actorId && authIdentityId && DB_URL) {
      console.log(`[Decrypt API - Shipper] 🔄 Attempting DB lookup for Auth ID: ${authIdentityId}`);
      const dbClient = new Client({
          connectionString: DB_URL,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
      
      try {
          await dbClient.connect();
          const linkRes = await dbClient.query(
              `SELECT user_id FROM user_user_auth_auth_identity WHERE auth_identity_id = $1`,
              [authIdentityId]
          );
          if (linkRes.rows.length > 0) {
              actorId = linkRes.rows[0].user_id; 
              console.log(`[Decrypt API - Shipper] ✅ DB lookup successful. Found actorId: ${actorId}`);
          }
      } catch (e) {
          console.error("[Decrypt API - Shipper] ❌ DB Lookup Error:", e);
      } finally {
          await dbClient.end();
        }
    }

  // 4. KIỂM TRA QUYỀN TRUY CẬP
  if (!actorId) {
      console.warn("[Decrypt API - Shipper] 🚫 UNAUTHORIZED: User ID not found.");
      return res.status(401).json({ error: "UNAUTHORIZED: Missing user ID." });
  }

  // --- LOGIC CHÍNH ---
  try {
      const userModuleService = req.scope.resolve(Modules.USER);
      const fabricService = new FabricServiceClass(req.scope); 

      // 5. Lấy Private Key và Role
      const user = await userModuleService.retrieveUser(actorId, {
          select: ["id", "email", "metadata"]
      });
      
      if (!user) {
          return res.status(401).json({ error: "User không tồn tại." });
      }

      // Check Role
      if (user.metadata?.fabric_role !== 'shipperorgmsp') {
           console.warn(`[Decrypt API - Shipper] 🚫 Access Denied. User role is ${user.metadata?.fabric_role}`);
           return res.status(403).json({ error: "Access denied. Only Shippers can perform this action." });
      }

      // Lấy Private Key (Lưu ý: Key này được tạo lúc đăng ký Shipper)
      const shipperPrivateKey = user.metadata?.rsa_private_key as string; 
    const shipperCompanyID = user.metadata?.company_code as string;
    
      console.log(`[Decrypt API - Shipper] 🔍 Actor: ${user.email} (Company: ${shipperCompanyID})`);
    
      if (!shipperPrivateKey) {
          console.error(`[Decrypt API - Shipper] ❌ Missing Private Key for User: ${actorId}`);
          return res.status(500).json({ error: "Missing shipper private key in user metadata." });
    }

      // 6. Gọi hàm Decrypt của Shipper
      // Hàm này cần được định nghĩa trong fabric.ts giống như decryptSellerData
    const decryptedData = await fabricService.decryptShipperData(
        orderId, 
          shipperPrivateKey, // Key riêng của Shipper A
          shipperCompanyID   // ID để Chaincode kiểm tra quyền
      );

      // 7. Xử lý kết quả trả về
      if (decryptedData && decryptedData.decrypted_shipper_data) {
          console.log(`[Decrypt API - Shipper] ✅ Decrypt SUCCESS for ${orderId}.`);
          
          // Trả về dữ liệu public + private đã giải mã
          // Frontend Shipper cần cả status, paymentMethod từ public data
          return res.json({
              ...decryptedData, 
              // Ưu tiên đè dữ liệu giải mã lên trên
              ...decryptedData.decrypted_shipper_data 
          });
      } else {
          const errorMessage = decryptedData?.error || "Data not found or decryption failed.";
          console.warn(`[Decrypt API - Shipper] ⚠️ Failed: ${errorMessage}`);
          return res.status(400).json({ error: errorMessage });
      }

  } catch (error: any) {
      console.error(`[Decrypt API - Shipper] ❌ Runtime Error: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
};