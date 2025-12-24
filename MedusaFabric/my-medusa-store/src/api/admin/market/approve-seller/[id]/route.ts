// src/api/admin/market/approve-seller/[id]/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";
import crypto from 'crypto'; // [MỚI] Import crypto để sinh khóa

const enrollSellerIdentity = require("../../../../../scripts/enroll-helper"); 

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params;
  const container = req.scope;
  
  const marketplaceService = container.resolve("marketplace") as any;
  const userModuleService = container.resolve(Modules.USER);

  try {
    const seller = await marketplaceService.retrieveSeller(id);
    if (!seller) return res.status(404).json({ error: "Seller not found" });

    console.log(`Approving Seller: ${seller.name} (${seller.company_code})...`);

    // 1. [MỚI] SINH CẶP KHÓA RSA RIÊNG CHO SELLER
    // -------------------------------------------------------------
    console.log(`Generating unique RSA keys for Seller: ${seller.company_code}...`);
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    // 2. Cập nhật Seller Profile (Lưu Public Key để KHÁCH HÀNG mã hóa đơn hàng)
    // -------------------------------------------------------------
    await marketplaceService.updateSellers([
      {
        id: id,
        status: "approved",
        metadata: {
            ...seller.metadata,
            rsa_public_key: publicKey // Lưu Public Key vào metadata của Seller
        }
      }
    ]);
    console.log("   -> Updated Seller Profile with Public Key");

    // 3. Cập nhật User (Lưu Private Key để SELLER tự giải mã)
    // -------------------------------------------------------------
    if (seller.admin_user_id) {
        const currentUser = await userModuleService.retrieveUser(seller.admin_user_id);
        
        await userModuleService.updateUsers([
          {
            id: seller.admin_user_id,
            metadata: { 
                ...(currentUser.metadata || {}), 
                approver_status: "approved",
                rsa_private_key: privateKey
            }
          }
        ]);
        console.log("   -> Updated User Profile with Private Key");
    } else {
      console.warn("Warning: Seller has no admin_user_id linked!");
    }

    // 4. [AUTO] Tạo Wallet (Identity trên Blockchain)
    // -------------------------------------------------------------
    console.log(`Auto-enrolling wallet for ${seller.company_code}...`);
    try {
        if (seller.company_code) {
            await enrollSellerIdentity(seller.company_code, seller.company_code); 
        console.log("Wallet created successfully!");
        }
    } catch (e: any) {
      console.warn("Enroll failed:", e.message);
    }

    res.json({ message: "Approved & Keys Generated successfully!" });

  } catch (error: any) {
    console.error("Approve Seller Error:", error);
    res.status(500).json({ error: error.message });
  }
};