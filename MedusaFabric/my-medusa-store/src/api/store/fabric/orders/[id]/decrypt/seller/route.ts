//my-medusa-store\src\api\store\fabric\orders\[id]\decrypt\seller\route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import jwt from "jsonwebtoken";
import { Modules } from "@medusajs/utils";
// Cần import Client từ pg
import { Client } from "pg"; 

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const DB_URL = process.env.DATABASE_URL;

// Dùng require để tránh lỗi DI: FabricServiceClass phải là Constructor
// Đảm bảo đường dẫn chính xác (thay đổi số ../ tùy theo thư mục của bạn)
const FabricServiceClass = require("../../../../../../../services/fabric");

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const orderId = req.params.id;
  console.log(`[Decrypt API] Attempting decrypt for Order: ${orderId} by Seller`);

  let actorId: string | undefined;
  let authIdentityId: string | undefined;

    // 1. LẤY ID TỪ AUTH CONTEXT (Ưu tiên ID đã được resolve)
  const authContext = (req as any).auth;
    if (authContext) {
        actorId = authContext.actor_id || authContext.user_id;
        authIdentityId = authContext.auth_identity_id;
    }

    // 2. TỰ LẤY ID VÀ AUTH_IDENTITY_ID TỪ TOKEN (Nếu context thất bại)
  if (!actorId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
          try {
                const token = authHeader.split(" ")[1];
                const decoded: any = jwt.verify(token, JWT_SECRET);
                
                // Cố gắng lấy Actor ID (Nếu nó không rỗng)
                const resolvedId = decoded.actor_id || decoded.sub;
                if (resolvedId) actorId = resolvedId;

                // Lấy Auth Identity ID (Dùng để tra cứu User ID)
                authIdentityId = decoded.auth_identity_id; 

                // Nếu có Token nhưng không có actorId, ta phải dựa vào Auth Identity ID
          } catch (err) {
        console.warn("[Decrypt API] Token verification failed.");
      }
    }
  }

    // 3. THỰC HIỆN TRA CỨU DB NẾU CHỈ CÓ AUTH ID VÀ THIẾU ACTOR ID
    if (!actorId && authIdentityId && DB_URL) {
    console.log(`[Decrypt API] Attempting DB lookup for Auth ID: ${authIdentityId}`);
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
        console.log(`[Decrypt API] DB lookup successful. Found actorId: ${actorId}`);
            }
        } catch (e) {
      console.error("[Decrypt API] DB Lookup Error:", e);
        } finally {
            await dbClient.end();
        }
    }

    // 4. KIỂM TRA ACTOR ID CUỐI CÙNG
    if (!actorId) {
    console.warn("[Decrypt API] UNAUTHORIZED: User ID not found.");
        return res.status(401).json({ error: "UNAUTHORIZED: Missing user ID for decryption." });
    }

    // --- LOGIC CHÍNH (ĐÃ CÓ ACTOR ID) ---
    try {
        const userModuleService: any = req.scope.resolve(Modules.USER);
        // Khởi tạo Fabric Service Instance
      const fabricService = new FabricServiceClass(req.scope); 

        // 5. Lấy Private Key và Company Code
      const user = await userModuleService.retrieveUser(actorId, {
          select: ["id", "email", "metadata"]
      });
        
        if (!user) {
      console.warn(`[Decrypt API] UNHANDLED: No user found for actorId: ${actorId}`);
            return res.status(401).json({ error: "UNAUTHORIZED: User không tồn tại." });
        }

        // Lấy Private Key của user đang đăng nhập (đã lưu trong fix-seller-keys.js)
        const sellerPrivateKey = user.metadata?.rsa_private_key; 
        const userCompanyCode = user.metadata?.company_code; // <-- Company Code BẮT BUỘC để check quyền Fabric
        
    console.log(`[Decrypt API] [${orderId}] Actor: ${user.email} (ID: ${userCompanyCode})`);
    console.log(`[Decrypt API] Private Key length: ${sellerPrivateKey ? sellerPrivateKey.length : 0}`);
      
        if (!sellerPrivateKey) {
      console.error(`[Decrypt API] Missing Private Key for User: ${actorId}`);
            return res.status(500).json({ error: "Missing seller private key in user metadata." });
      }

        // 6. Gọi hàm Decrypt (TRUYỀN companyCode vào để Chaincode kiểm tra quyền)
        const decryptedData = await fabricService.decryptSellerData(orderId, sellerPrivateKey, userCompanyCode);

        if (decryptedData && decryptedData.decrypted_seller_data) {
      console.log(`[Decrypt API] Decrypt SUCCESS for ${orderId}.`);
            // Trả về chỉ dữ liệu đã giải mã (Decrypted Seller Data)
            return res.json(decryptedData.decrypted_seller_data);
        } else {
            // Lỗi Decrypt do Key hoặc dữ liệu không tồn tại
            const statusCode = decryptedData?.error ? 400 : 404; 
            const errorMessage = decryptedData?.error || "Order sensitive data not found or failed decryption.";
            
      console.warn(`[Decrypt API] Decrypt failed (Status: ${statusCode}). Error: ${errorMessage}`);
            return res.status(statusCode).json({ error: errorMessage });
        }

  } catch (error: any) {
    console.error(`[Decrypt API] Runtime Error: ${error.message}`);
        // Chaincode Errors sẽ được bắt ở đây
        return res.status(500).json({ error: error.message });
  }
};