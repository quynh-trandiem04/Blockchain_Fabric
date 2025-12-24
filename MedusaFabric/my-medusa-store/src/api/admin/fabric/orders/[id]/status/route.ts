// src\api\admin\fabric\orders\[id]\status\route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";

const FabricServiceClass = require("../../../../../../services/fabric");

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const orderId = req.params.id;
  
  try {
    const fabricService = new FabricServiceClass(req.scope);

    // 1. Thử tìm đơn gốc (trường hợp không tách đơn)
    let originalOrder: any = null; // Khai báo kiểu any
    try {
        originalOrder = await fabricService.queryOrder(orderId, 'admin');
    } catch (e) { /* Ignore not found */ }

    // 2. Tìm tất cả đơn tách (Split Orders)
    // FIX: Khai báo kiểu mảng là any[] để tránh lỗi 'never'
    const splitOrders: any[] = []; 
    
    let splitIndex = 1;
    let foundSplit = true;

    while (foundSplit && splitIndex <= 10) { 
        const splitId = `${orderId}_${splitIndex}`;
        try {
            const data = await fabricService.queryOrder(splitId, 'admin');
            if (data && !data.error) {
                // FIX: Thêm thuộc tính isSplit vào object
                splitOrders.push({ ...data, isSplit: true });
            } else {
                if (splitIndex === 1) foundSplit = false;
            }
        } catch (e) {
            foundSplit = false; 
        }
        splitIndex++;
    }

    // 3. Logic trả về kết quả
    
    // Trường hợp A: Có đơn tách (Split Orders)
    if (splitOrders.length > 0) {
        return res.json({
            isSplit: true,
            // FIX: TypeScript giờ đã hiểu splitOrders là any[]
            orders: splitOrders.map((o: any) => ({
                id: o.orderID,
                status: o.status,
                paymentMethod: o.paymentMethod,
                codStatus: o.codStatus || (o.paymentMethod === 'COD' ? 'PENDING' : ""),
                updatedAt: o.updatedAt
            }))
      });
    }

    // Trường hợp B: Chỉ có đơn gốc (Original Order)
    if (originalOrder && !originalOrder.error) {
    return res.json({
            isSplit: false,
            orders: [{
                id: originalOrder.orderID,
                status: originalOrder.status,
                paymentMethod: originalOrder.paymentMethod,
                codStatus: originalOrder.codStatus || (originalOrder.paymentMethod === 'COD' ? 'PENDING' : ""),
                updatedAt: originalOrder.updatedAt
            }]
        });
    }

    // Trường hợp C: Không tìm thấy gì
    console.warn(`[Admin API] ❌ Order ${orderId} not found on chain.`);
    return res.status(404).json({ status: "NOT_SYNCED", paymentMethod: "-" });

  } catch (error: any) {
    console.error(`[Admin API] System Error querying ${orderId}:`, error.message);
    return res.status(500).json({ error: error.message });
  }
};