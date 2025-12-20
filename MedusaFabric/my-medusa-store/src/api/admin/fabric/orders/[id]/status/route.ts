// src\api\admin\fabric\orders\[id]\status\route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";

const FabricServiceClass = require("../../../../../../services/fabric");

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const orderId = req.params.id;
  
  try {
    const fabricService = new FabricServiceClass(req.scope);

    let orderData: any = null;

    // BƯỚC 2: Nếu không thấy, thử tìm với suffix "_1" (Logic tách đơn)
    if (!orderData || orderData.error) {
        const splitId = `${orderId}_1`;
        try {
            console.log(`[Admin API] Original ID not found. Trying split ID: ${splitId}`);
            // Gọi queryOrder với ID đã thêm suffix
            orderData = await fabricService.queryOrder(splitId, 'admin');
        } catch (e) {
             console.warn(`[Admin API] Split ID ${splitId} also failed.`);
        }
    }

    // BƯỚC 3: Kiểm tra kết quả cuối cùng
    if (!orderData || orderData.error) {
      console.warn(`[Admin API] ❌ Order ${orderId} not found on chain.`);
      return res.status(404).json({ 
          status: "NOT_SYNCED", 
          paymentMethod: "-" 
      });
    }

    // BƯỚC 4: Trả về dữ liệu chuẩn cho UI
    console.log(`[Admin API] ✅ Found data for ${orderId}: ${orderData.status}`);

    return res.json({
      status: orderData.status,
      paymentMethod: orderData.paymentMethod,
      // Đảm bảo trả về codStatus nếu có
      codStatus: orderData.codStatus || (orderData.paymentMethod === 'COD' ? 'PENDING' : ""),
        updatedAt: orderData.updatedAt
    });

  } catch (error: any) {
    console.error(`[Admin API] System Error querying ${orderId}:`, error.message);
    return res.status(500).json({ error: error.message });
  }
};