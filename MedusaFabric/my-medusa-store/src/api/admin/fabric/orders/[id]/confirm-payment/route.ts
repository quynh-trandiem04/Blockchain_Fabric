// src/api/admin/fabric/orders/[id]/confirm-payment/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
const FabricServiceClass = require("../../../../../../services/fabric");

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const orderId = req.params.id;

  try {
    const fabricService = new FabricServiceClass(req.scope);
    
    // Gọi hàm confirmPayment mới (đã bao gồm logic xử lý hàng loạt)
    const result = await fabricService.confirmPayment(orderId);

    return res.json({
      message: "Payment confirmed for all split orders.",
      details: result
    });

  } catch (error: any) {
    console.error(`CONFIRM PAYMENT ERROR:`, error);
    // Trả về lỗi 500 kèm message để UI hiển thị Toast error
    return res.status(500).json({ 
        message: "Failed to confirm payment on Blockchain.",
        error: error.message 
    });
  }
};