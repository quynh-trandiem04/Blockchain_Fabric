// src/api/admin/fabric/orders/list/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";

const FabricServiceClass = require("../../../../../services/fabric");

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const fabricService = new FabricServiceClass(req.scope);
// Resolve User Module để lấy dữ liệu User nội bộ
    const userModuleService = req.scope.resolve(Modules.USER);
    
    // 1. Lấy danh sách đơn hàng từ Blockchain
    const orders = await fabricService.listAllOrdersForAdmin();

    // 2. Lấy toàn bộ Users (chỉ lấy field cần thiết để tối ưu)
    // Lưu ý: Dùng service nội bộ sẽ bypass được validation HTTP layer
    const users = await userModuleService.listUsers(
        {}, 
        { select: ["email", "metadata"] }
    );

// 3. Tạo Map: { "Shop_Code": "email@shop.com" } để tra cứu nhanh
    const emailMap: Record<string, string> = {};
    users.forEach((u: any) => {
        if (u.metadata?.company_code) {
            emailMap[u.metadata.company_code as string] = u.email;
        }
    });

    // 4. Gán Email vào danh sách đơn hàng
    const enrichedOrders = orders.map((o: any) => ({
        ...o,
// Tra cứu từ Map, nếu không có thì để null hoặc chuỗi mặc định
        seller_email: emailMap[o.seller_id] || "",
        shipper_email: emailMap[o.shipper_id] || ""
    }));

    return res.json({ orders: enrichedOrders });

  } catch (error: any) {
    console.error(`[Admin API] List Orders Error:`, error.message);
    return res.status(500).json({ error: error.message });
  }
};