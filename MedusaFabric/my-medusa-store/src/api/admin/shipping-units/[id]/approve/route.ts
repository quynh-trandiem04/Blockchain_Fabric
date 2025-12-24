// src/api/admin/shipping-units/[id]/approve/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";
import crypto from 'crypto';

// Import script enroll cho Shipper
const enrollShipperIdentity = require("../../../../../scripts/enroll-shipper-helper");

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params; // ID của User (Shipper)
  const container = req.scope;
  
  const userModuleService = container.resolve(Modules.USER);
  // [MỚI] Cần Marketplace Service để cập nhật bảng Carrier
  const marketplaceService = container.resolve("marketplace") as any;

  try {
        console.log(`Approving Shipper User ID: ${id}...`);

    // 1. Lấy thông tin User hiện tại
    const user = await userModuleService.retrieveUser(id);
    if (!user) {
        return res.status(404).json({ error: "Shipper User not found" });
    }

    const companyCode = user.metadata?.company_code;
    if (!companyCode) {
        return res.status(400).json({ error: "User này thiếu company_code trong metadata" });
    }

    // 2. SINH CẶP KHÓA RSA RIÊNG CHO SHIPPER NÀY 
        console.log(`Generating unique RSA keys for Shipper: ${companyCode}...`);
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    // 3. Cập nhật User (Lưu Private Key để Shipper tự giải mã & Trạng thái duyệt)
    await userModuleService.updateUsers([
        {
            id: id,
            metadata: {
                ...(user.metadata || {}), 
                approver_status: "approved",
                rsa_private_key: privateKey // User giữ chìa khóa bí mật
            }
        }
    ]);

    // 4. Cập nhật Carrier Profile (Lưu Public Key để mọi người mã hóa gửi cho Shipper)
    // Tìm Carrier dựa vào company_code
    const carriers = await marketplaceService.listCarriers({ code: companyCode });
    if (carriers.length > 0) {
        const carrierId = carriers[0].id;
        // Giả sử Carrier model chưa có cột metadata, ta cần chắc chắn model đã hỗ trợ
        // Nếu chưa, bạn cần migration thêm cột metadata cho bảng Carrier hoặc API update hỗ trợ nó
        // Ở đây ta gọi updateCarriers
        await marketplaceService.updateCarriers([
            {
                id: carrierId,
                // Lưu Public Key. Nếu model Carrier chưa có metadata, bạn có thể cần thêm vào migration.
                // Tạm thời ta giả định Marketplace Service xử lý được metadata
                metadata: {
                    rsa_public_key: publicKey
                }
            }
        ]);
        console.log("   -> Updated Carrier Profile with Public Key");
    } else {
            console.warn("Warning: Carrier Profile not found for code:", companyCode);
    }

    // 5. [AUTO] Tạo Wallet trên Blockchain
    console.log(`⚡ Auto-enrolling wallet for ${companyCode}...`);
    try {
        await enrollShipperIdentity(companyCode, companyCode);
        console.log("✅ Wallet created successfully!");
    } catch (e: any) {
        console.warn("⚠️ Enroll failed:", e.message);
        // Không return lỗi ở đây để tránh rollback DB nếu chỉ lỗi tạo ví (có thể retry sau)
    }

    res.json({ message: "Đã duyệt đơn vị vận chuyển & Tạo khóa bảo mật thành công." });

  } catch (error: any) {
    console.error("❌ Approve Shipper Error:", error);
    res.status(500).json({ error: error.message || "Lỗi Server khi duyệt." });
  }
};