// my-medusa-store\src\api\admin\market\reject-seller\[id]\route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params;
  const container = req.scope;
  
  const marketplaceService = container.resolve("marketplace") as any;
  const userModuleService = container.resolve(Modules.USER);

  try {
    console.log(`Deleting rejected seller ID: ${id}...`);

    // 1. Lấy thông tin Seller trước để biết User ID là gì
    const seller = await marketplaceService.retrieveSeller(id).catch(() => null);
    
    if (!seller) {
        return res.status(404).json({ error: "Seller not found" });
    }

    // 2. XÓA Seller Profile (Dùng deleteSellers nhận vào mảng ID)
    await marketplaceService.deleteSellers([id]);
    console.log(`   -> Deleted Marketplace Seller Profile`);

    // 3. XÓA Medusa User (Để giải phóng email cho lần đăng ký sau)
    if (seller.admin_user_id) {
        // Lưu ý: deleteUsers cũng nhận vào mảng ID
        await userModuleService.deleteUsers([seller.admin_user_id]);
        console.log(`   -> Deleted Medusa User (Email freed)`);
    }

    console.log("Reject & Delete success");
    res.json({ message: "Đã từ chối và xóa dữ liệu thành công. Email đã có thể đăng ký lại." });

  } catch (error: any) {
    console.error("Reject Error:", error);
    res.status(500).json({ error: error.message || "Lỗi Server khi xóa." });
  }
};