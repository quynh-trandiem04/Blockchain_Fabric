// my-medusa-store/src/api/store/market/active-shippers/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";

export const OPTIONS = async (req: MedusaRequest, res: MedusaResponse) => {
  res.set("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, x-publishable-api-key");
  res.sendStatus(200);
};

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const userModuleService = req.scope.resolve(Modules.USER);

  try {
    // [FIX LỖI]: Tách tham số thành 2 object riêng biệt
    const users = await userModuleService.listUsers(
        {}, // Tham số 1: Filters (Để rỗng để lấy tất cả user)
        { take: 1000 } // Tham số 2: Config (Phân trang)
    );

    // 2. Lọc ra Shipper đã được duyệt
    const activeShippers = users
      .filter((u) => 
        u.metadata?.fabric_role === "shipperorgmsp" && 
        u.metadata?.approver_status === "approved"
      )
      .map((u) => ({
        id: u.id,
        name: u.metadata?.carrier_name || "Shipper chưa đặt tên",
        // Lấy giá ship từ metadata, mặc định 10 nếu chưa set
        price: u.metadata?.shipping_fee ? parseInt(u.metadata.shipping_fee as string) : 10,
        company_code: u.metadata?.company_code
      }));

    res.json({ shippers: activeShippers });

  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};