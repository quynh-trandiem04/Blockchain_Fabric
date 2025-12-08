// src/api/admin/market/approve-seller/[id]/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";

const enrollSellerIdentity = require("../../../../../scripts/enroll-helper"); 

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params;
  const container = req.scope;
  
  const marketplaceService = container.resolve("marketplace") as any;
  const userModuleService = container.resolve(Modules.USER);

  try {
    const seller = await marketplaceService.retrieveSeller(id);
    if (!seller) return res.status(404).json({ error: "Seller not found" });

    // [FIX LỖI]: updateSellers nhận mảng
    await marketplaceService.updateSellers([
      {
        id: id,
        status: "approved"
      }
    ]);

    // [FIX LỖI]: updateUsers nhận mảng
    if (seller.admin_user_id) {
        // Lấy user hiện tại để merge metadata (tránh mất dữ liệu cũ)
        const currentUser = await userModuleService.retrieveUser(seller.admin_user_id);
        
        await userModuleService.updateUsers([
          {
            id: seller.admin_user_id,
            metadata: { 
                ...(currentUser.metadata || {}), 
                approver_status: "approved" 
            }
          }
        ]);
    }

    // 4. [AUTO] Tạo Wallet
    console.log(`⚡ Auto-enrolling wallet for ${seller.company_code}...`);
    try {
        if (seller.company_code) {
            await enrollSellerIdentity(seller.company_code, seller.company_code); 
            console.log("✅ Wallet created successfully!");
        }
    } catch (e: any) {
        console.warn("⚠️ Enroll failed:", e.message);
    }

    res.json({ message: "Approved successfully!" });

  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};