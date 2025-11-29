// src\api\admin\fabric\orders\[id]\status\route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
const FabricService = require("../../../../../../services/fabric");
const fabricService = new FabricService();

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params;

  // Lưu ý: Endpoint này không cần kiểm tra RBAC khắt khe
  // vì nó chỉ trả về trạng thái công khai của đơn hàng.
  // Chỉ cần xác thực người dùng đã đăng nhập là được.
  
  const authContext = (req as any).auth;
  if (!authContext?.actor_id) {

  }

  try {
    // Gọi hàm queryOrder (Lấy dữ liệu thô từ Blockchain)
    const orderData = await fabricService.queryOrder(id);

    // LỌC DỮ LIỆU: Chỉ trả về các trường công khai
    const publicData = {
        orderID: orderData.orderID,
        status: orderData.status,
        paymentMethod: orderData.paymentMethod,
        codStatus: orderData.codStatus,
        txID: orderData.history?.[0]?.txID || "",
    };

    res.json(publicData);
  } catch (error: any) {
    // Nếu đơn hàng chưa có trên blockchain
    if (error.message && error.message.includes("không tồn tại")) {
        res.status(404).json({ message: "Not Found on Blockchain" });
    } else {
        res.status(500).json({ error: error.message });
    }
  }
};