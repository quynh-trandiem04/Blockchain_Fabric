// my-medusa-store/src/api/store/market/shipper/update/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";
import jwt from "jsonwebtoken";
import { Client } from "pg";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

export const OPTIONS = async (req: MedusaRequest, res: MedusaResponse) => {
  res.set("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, x-publishable-api-key, Authorization");
  res.sendStatus(200);
};

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { carrier_name, phone, shipping_fee } = req.body as any;
  const container = req.scope;
  const userModuleService = container.resolve(Modules.USER);
  
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "No token provided" });
  
  const dbClient = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    const token = authHeader.split(" ")[1];
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const authId = decoded.auth_identity_id || decoded.sub;

    await dbClient.connect();
    
    // Tìm User ID từ Auth ID
    const linkRes = await dbClient.query(
        `SELECT user_id FROM link_user_auth_identity WHERE auth_identity_id = $1 UNION ALL SELECT user_id FROM user_user_auth_auth_identity WHERE auth_identity_id = $1`,
        [authId]
    );
    
    if (linkRes.rows.length === 0) return res.status(404).json({ message: "User not found" });
    const userId = linkRes.rows[0].user_id;

    // Lấy user cũ để merge metadata
    const currentUser = await userModuleService.retrieveUser(userId);

    // Update User
    await userModuleService.updateUsers([{
        id: userId,
        metadata: {
            ...(currentUser.metadata || {}),
            carrier_name,
            phone,
            shipping_fee // Lưu giá tiền
        }
    }]);

    res.json({ message: "Update success" });

  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message });
  } finally {
      await dbClient.end();
  }
};