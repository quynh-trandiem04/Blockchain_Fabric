// my-medusa-store/src/api/admin/shipping-units/[id]/approve/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params; // ID của User (Shipper)
  const container = req.scope;
  
  const userModuleService = container.resolve(Modules.USER);

  try {
    console.log(`✅ Approving Shipper User ID: ${id}...`);

    // 1. Lấy thông tin User hiện tại
    const user = await userModuleService.retrieveUser(id);
    
    if (!user) {
        return res.status(404).json({ error: "Shipper User not found" });
    }

    // 2. Cập nhật Metadata thành 'approved'
    // Lưu ý: Dùng updateUsers với mảng [{ id, metadata }]
    await userModuleService.updateUsers([
        {
            id: id,
            metadata: {
                ...(user.metadata || {}), // Giữ lại metadata cũ (tên, sđt...)
                approver_status: "approved" 
            }
        }
    ]);

    console.log("✅ Approve Shipper success");
    res.json({ message: "Đã duyệt đơn vị vận chuyển thành công." });

  } catch (error: any) {
    console.error("❌ Approve Shipper Error:", error);
    res.status(500).json({ error: error.message || "Lỗi Server khi duyệt." });
  }
};