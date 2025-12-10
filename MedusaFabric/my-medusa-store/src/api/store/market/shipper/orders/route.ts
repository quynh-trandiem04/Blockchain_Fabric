// my-medusa-store/src/api/store/market/shipper/update/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";
import jwt from "jsonwebtoken";
import { Client } from "pg";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

export const OPTIONS = async (req: MedusaRequest, res: MedusaResponse) => {
  res.set("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, x-publishable-api-key, Authorization");
  res.sendStatus(200);
};

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const container = req.scope;
  const userModuleService = container.resolve(Modules.USER);
  const orderModuleService = container.resolve(Modules.ORDER);

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "No token provided" });

  const dbClient = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    const token = authHeader.split(" ")[1];
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const authId = decoded.auth_identity_id || decoded.sub;

    await dbClient.connect();
    
    // Tìm User & Carrier Code
    const linkRes = await dbClient.query(
        `SELECT user_id FROM link_user_auth_identity WHERE auth_identity_id = $1 UNION ALL SELECT user_id FROM user_user_auth_auth_identity WHERE auth_identity_id = $1`,
        [authId]
    );
    if (linkRes.rows.length === 0) return res.status(404).json({ message: "User not found" });
    const userId = linkRes.rows[0].user_id;
    const user = await userModuleService.retrieveUser(userId);
    
    // Check Role
    if (user.metadata?.fabric_role !== 'shipperorgmsp') {
        return res.status(403).json({ message: "Access denied" });
    }

    // LẤY LIST ORDER
    // [FIX LỖI]: Chuyển 'take' sang tham số thứ 2 (config object)
    const orders = await orderModuleService.listOrders(
        {}, // Tham số 1: Filters (Để rỗng để lấy hết hoặc thêm điều kiện lọc nếu cần)
        {   // Tham số 2: Config (Phân trang, Relations, Select...)
            take: 100, 
            relations: ["payment_collections", "payment_collections.payment_sessions"],
            order: { created_at: "DESC" } // Sắp xếp mới nhất trước
        }
    );

    res.json({ orders });

  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message });
  } finally {
      await dbClient.end();
  }
};