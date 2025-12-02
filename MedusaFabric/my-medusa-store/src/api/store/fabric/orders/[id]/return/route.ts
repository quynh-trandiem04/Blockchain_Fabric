// src/api/store/fabric/orders/[id]/return/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";

const FabricService = require("../../../../../../services/fabric");
const fabricService = new FabricService();

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params;
  console.log(`[Store API] Requesting Return for: ${id}`);

  try {
    // Gọi hàm requestReturn trong Service
    const txId = await fabricService.requestReturn(id);

    res.json({
      message: "Đã gửi yêu cầu trả hàng thành công!",
      tx_id: txId
    });

  } catch (error: any) {
    console.error("[Store API] Return Error:", error.message);
    
    // Bắt lỗi logic từ Chaincode (ví dụ: quá hạn 5 phút)
    // Chaincode trả về: "đã quá 7 ngày..."
    if (error.message && (error.message.includes("đã quá") || error.message.includes("thời gian"))) {
         return res.status(400).json({ error: "Đã quá thời hạn trả hàng (5 phút)!" });
    }
    
    // Các lỗi khác (ví dụ: chưa Delivered)
    res.status(500).json({ error: error.message || "Lỗi hệ thống." });
  }
};