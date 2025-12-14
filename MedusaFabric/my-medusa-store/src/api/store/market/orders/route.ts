// my-medusa-store/src/api/store/market/orders/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";
import jwt from "jsonwebtoken";
import { Client } from "pg"; 

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const container = req.scope;
  const userModuleService = container.resolve(Modules.USER);
  
  // [FIX LỖI QUAN TRỌNG]: Dùng Modules.ORDER thay vì string "orderService"
  const orderModuleService = container.resolve(Modules.ORDER);

  // 1. Xác thực Token
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "No token" });
  
  const dbClient = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    const token = authHeader.split(" ")[1];
    const decoded: any = jwt.verify(token, JWT_SECRET);
    // Token v2 thường dùng 'sub' hoặc 'auth_identity_id'
    const authId = decoded.auth_identity_id || decoded.sub;

    await dbClient.connect();
    
    // 2. Tìm User ID từ Auth ID (SQL cho chắc chắn)
    const linkRes = await dbClient.query(
        `SELECT user_id FROM user_user_auth_auth_identity WHERE auth_identity_id = $1`,
        [authId]
    );
    if (linkRes.rows.length === 0) throw new Error("User not linked");
    const userId = linkRes.rows[0].user_id;

    // 3. Lấy thông tin Shop của Seller
    const user = await userModuleService.retrieveUser(userId, { select: ["metadata"] });
    const companyCode = user.metadata?.company_code;

    if (!companyCode) return res.json({ orders: [] });

    // 4. Lấy danh sách đơn hàng (Order Module v2 API)
    // Lưu ý: listOrders của v2 có cú pháp hơi khác v1
    const orders = await orderModuleService.listOrders(
        {}, // Filter rỗng trước, ta lọc sau bằng code cho dễ
        { 
            relations: ["items", "shipping_address"],
            take: 100, // Giới hạn số lượng
            order: { created_at: "DESC" }
        }
    );

    // 5. Lọc đơn hàng thuộc về Shop này
    const sellerOrders = orders.filter(order => {
        const bcData = order.metadata?.blockchain_data as any[];
        if (bcData && Array.isArray(bcData)) {
            // Kiểm tra trong metadata của Order xem có split order nào của shop này không
            return bcData.some(split => split.seller === companyCode);
        }
        return false;
    });

    res.json({ orders: sellerOrders });

  } catch (error: any) {
    console.error("List Order Error:", error);
    res.status(500).json({ error: error.message });
  } finally {
      await dbClient.end();
  }
};