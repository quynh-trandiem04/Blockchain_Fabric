// my-medusa-store/src/api/store/market/seller-me/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";
import jwt from "jsonwebtoken";
import { Client } from "pg"; 

const JWT_SECRET = process.env.JWT_SECRET;

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const container = req.scope;
  const userModuleService = container.resolve(Modules.USER);
  
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Missing Token" });
  }
  const token = authHeader.split(" ")[1];

  const dbClient = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // 1. Decode Token
    const decoded: any = jwt.verify(token, JWT_SECRET);
    console.log("🎟️ Decoded Token Payload:", decoded);

    // Lấy Auth ID từ token (Token v2 thường để ở 'sub' hoặc 'auth_identity_id')
    const authId = decoded.auth_identity_id || decoded.sub;

    if (!authId) {
        return res.status(401).json({ message: "Invalid Token: Missing Auth ID", payload: decoded });
    }

    // 2. Tự tìm User ID bằng SQL (Bỏ qua cơ chế Link mặc định nếu nó lỗi)
    await dbClient.connect();
    
    // Query cả 2 bảng link có thể có để chắc chắn tìm thấy
    const linkRes = await dbClient.query(
        `SELECT user_id FROM user_user_auth_auth_identity WHERE auth_identity_id = $1`,
        [authId]
    );

    if (linkRes.rows.length === 0) {
        console.error(`❌ No Link found for AuthID: ${authId}`);
        // Fallback: In ra danh sách bảng để debug nếu tên bảng vẫn sai
        const tables = await dbClient.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'link_%'`);
        console.log("Existing Link Tables:", tables.rows.map(r => r.tablename));
        
        return res.status(404).json({ message: "User not linked to this Account" });
    }

    const userId = linkRes.rows[0].user_id;
    console.log(`✅ Resolved User ID from DB: ${userId}`);

    // 3. Lấy thông tin User
    const user = await userModuleService.retrieveUser(userId, { 
        select: ["id", "email", "metadata"] 
    }).catch(() => null);

    if (!user) {
        return res.status(404).json({ message: "User profile not found in DB" });
    }
    console.log("User: ", user)
    res.json({ user });

  } catch (error: any) {
    console.error("❌ Seller Me Error:", error);
    res.status(401).json({ message: "Unauthorized", error: error.message });
  } finally {
      await dbClient.end();
  }
};