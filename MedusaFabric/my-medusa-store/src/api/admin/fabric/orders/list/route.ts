// src/api/admin/fabric/orders/list/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";

const FabricServiceClass = require("../../../../../services/fabric");

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const fabricService = new FabricServiceClass(req.scope);
    
    // Gọi hàm mới dành cho Admin
    const orders = await fabricService.listAllOrdersForAdmin();

    return res.json({ orders });

  } catch (error: any) {
    console.error(`[Admin API] List Orders Error:`, error.message);
    return res.status(500).json({ error: error.message });
  }
};