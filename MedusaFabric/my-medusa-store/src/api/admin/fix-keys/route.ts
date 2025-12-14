// src/api/admin/fix-keys/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";

// Import file script vừa tạo ở trên
const fixSellerKeys = require("../../../scripts/fix-seller-keys");

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    // Gọi hàm fix và truyền container (req.scope) vào
    await fixSellerKeys(req.scope);
    
    res.json({ message: "Fix keys & wallets successfully executed" });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};