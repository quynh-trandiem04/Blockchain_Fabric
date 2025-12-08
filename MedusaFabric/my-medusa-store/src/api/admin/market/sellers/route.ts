// my-medusa-store/src/api/admin/market/sellers/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const container = req.scope;
  const marketplaceService = container.resolve("marketplace") as any;

  try {
    // Lấy tham số lọc từ URL (VD: ?status=pending)
    const { status } = req.query;

    const selector: any = {};
    if (status) {
        selector.status = status;
    }

    // Gọi hàm listSellers (được Medusa tự động sinh ra từ Model Seller)
    const sellers = await marketplaceService.listSellers(selector);

    res.json({ sellers });

  } catch (error: any) {
    console.error("List Sellers Error:", error);
    res.status(500).json({ error: error.message });
  }
};