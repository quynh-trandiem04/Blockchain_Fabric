// my-medusa-store/src/api/admin/shipping-units/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  // Lấy User Service từ container
  const userModuleService = req.scope.resolve(Modules.USER);

  try {
    // [FIX LỖI TS]: Tách filters và config ra làm 2 tham số
    const users = await userModuleService.listUsers(
        {}, // Tham số 1: Filters (Để rỗng để lấy tất cả)
        {   // Tham số 2: Config (Phân trang, Sắp xếp)
            take: 1000,
            order: { created_at: "DESC" } 
        }
    );

    // 2. Lọc thủ công dựa trên Metadata
    const pendingShippingUnits = users.filter((user) => 
      user.metadata?.fabric_role === "shipperorgmsp" && 
      user.metadata?.approver_status === "pending"
    );

    // 3. Trả về kết quả
    res.json({ shipping_units: pendingShippingUnits });

  } catch (error: any) {
    console.error("List Shipping Units Error:", error);
    res.status(500).json({ 
        message: "Lỗi khi lấy danh sách đơn vị vận chuyển", 
        error: error.message 
    });
  }
};