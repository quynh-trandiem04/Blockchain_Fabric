// src/api/admin/fabric/orders/list/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";

const FabricServiceClass = require("../../../../../services/fabric");


// ... các phần import giữ nguyên

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const fabricService = new FabricServiceClass(req.scope);
    const userModuleService = req.scope.resolve(Modules.USER);

    // 1. Lấy danh sách đơn hàng từ Blockchain
    let orders = await fabricService.listAllOrdersForAdmin();

    // [QUAN TRỌNG]: Kiểm tra nếu orders bị lỗi hoặc không phải mảng
    if (!orders || !Array.isArray(orders)) {
      console.warn("[Admin API] Blockchain returned empty or invalid orders list.");
      orders = [];
    }

    // 2. Lấy toàn bộ Users
    const users = await userModuleService.listUsers(
      {},
      { select: ["email", "metadata"] }
    );

    const emailMap: Record<string, string> = {};
    users.forEach((u: any) => {
      if (u.metadata?.company_code) {
        emailMap[u.metadata.company_code as string] = u.email;
      }
    });

    // 4. Gán Email và Fix lỗi thiếu trường cho đơn cũ
    const enrichedOrders = orders.map((o: any) => ({
      ...o,
      // Phải có trường id này để React không báo lỗi key
      id: o.blockchain_id,
      baseAmount: o.baseAmount || 0,
      seller_email: emailMap[o.seller_id] || "N/A",
      shipper_email: emailMap[o.shipper_id] || "N/A"
    }));

    // Sắp xếp đơn hàng mới nhất lên đầu dựa vào blockchain_id hoặc ngày tạo
    const finalOrders = enrichedOrders.sort((a: any, b: any) => b.id.localeCompare(a.id));

    return res.json({ orders: finalOrders });

  } catch (error: any) {
    console.error(`[Admin API] List Orders Error:`, error.message);
    // Trả về mảng rỗng thay vì lỗi 500 để UI không bị trắng trang
    return res.json({ orders: [], error: error.message });
  }
};