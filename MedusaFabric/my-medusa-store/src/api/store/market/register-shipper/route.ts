// my-medusa-store/src/api/store/market/register-shipper/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";
import { Client } from "pg"; 

export const AUTHENTICATE = false; 

export const OPTIONS = async (req: MedusaRequest, res: MedusaResponse) => {
  res.set("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, DELETE, PUT");
  res.set("Access-Control-Allow-Headers", "Content-Type, x-publishable-api-key, Authorization");
  res.set("Access-Control-Allow-Credentials", "true");
  res.sendStatus(200);
};

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  // Nhận thông tin đăng ký từ Shipper
  const { email, password, carrier_name, phone } = req.body as any;
  const container = req.scope;

  const userModuleService = container.resolve(Modules.USER);
  const marketplaceService = container.resolve("marketplace") as any;
  const remoteLink = container.resolve("remoteLink");

  const host = req.get("host");
  const protocol = req.protocol;
  const baseUrl = `${protocol}://${host}`;

  let createdUserId: string | null = null;
  let createdAuthId: string | null = null;

  const dbClient = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await dbClient.connect();

    // 1. Kiểm tra email tồn tại chưa
    const existingUsers = await userModuleService.listUsers({ email }, { take: 1 });
    if (existingUsers.length > 0) {
        return res.status(400).json({ error: "Email đã tồn tại" });
    }

    // 2. Gọi API Đăng ký Auth chuẩn của Medusa
    console.log("1. Calling Internal Auth Register API for Shipper...");
    
    const authRes = await fetch(`${baseUrl}/auth/user/emailpass/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: email,
            password: password
        })
    });

    const authData = await authRes.json();

    if (!authRes.ok) {
        console.error("Auth Register Failed:", authData);
        throw new Error(authData.message || "Lỗi tạo tài khoản đăng nhập");
    }

    // 3. Lấy Auth ID từ bảng provider_identity (Fix giống Seller)
    console.log("2. Fetching Auth ID via SQL...");
    
    // Delay nhẹ để DB commit
    await new Promise(r => setTimeout(r, 500));

    const sqlRes = await dbClient.query(
        `SELECT auth_identity_id 
         FROM provider_identity 
         WHERE entity_id = $1 
         AND provider = 'emailpass'`,
        [email]
    );

    if (sqlRes.rows.length === 0) {
        // Fallback: Lấy Auth mới nhất nếu không tìm thấy (Chỉ dùng cho dev/test flow nhanh)
        console.warn("   -> Direct lookup failed, trying fallback...");
        const fallbackRes = await dbClient.query(
             `SELECT id FROM auth_identity ORDER BY created_at DESC LIMIT 1`
        );
        if (fallbackRes.rows.length > 0) {
             createdAuthId = fallbackRes.rows[0].id;
        } else {
             throw new Error("Không tìm thấy Auth Identity sau khi đăng ký.");
        }
    } else {
        createdAuthId = sqlRes.rows[0].auth_identity_id;
    }

    console.log(`   -> Auth Identity Found: ${createdAuthId}`);

    // 4. Tạo User Profile cho Shipper
    console.log("3. Creating User Profile...");
    const user = await userModuleService.createUsers({
        email,
        metadata: {
            fabric_role: "shipperorgmsp",
            company_code: `Carrier_${Date.now()}`,
            approver_status: "pending",
            carrier_name: carrier_name,
            phone: phone
        }
    });
    createdUserId = user.id;

    // 5. Link User & Auth
    console.log("4. Linking User & Auth...");
    await remoteLink.create([
        {
            [Modules.USER]: { user_id: createdUserId },
            [Modules.AUTH]: { auth_identity_id: createdAuthId },
        },
    ]);

    // 6. Tạo Carrier Profile (Thay vì Seller Profile)
    // Lưu ý: Bạn cần đảm bảo Model Carrier trong module marketplace có các trường tương ứng
    console.log("5. Creating Carrier Profile...");
    const carrier = await marketplaceService.createCarriers({
        name: carrier_name,
        code: user.metadata?.company_code, // Dùng chung mã company_code
        // Các trường metadata khác nếu cần lưu email/phone vào bảng carrier
        // (Tùy thuộc vào định nghĩa model Carrier của bạn, ở đây giả sử chỉ có name và code)
    });

    res.json({ message: "Đăng ký Shipper thành công! Vui lòng chờ Admin phê duyệt.", carrier_id: carrier.id });

  } catch (error: any) {
        console.error("Register Shipper Error:", error);
    
    // Rollback (Xóa rác nếu lỗi giữa chừng)
    if (createdUserId) await userModuleService.deleteUsers([createdUserId]);
    if (createdAuthId) {
        try {
             await dbClient.query(`DELETE FROM provider_identity WHERE auth_identity_id = $1`, [createdAuthId]);
             await dbClient.query(`DELETE FROM auth_identity WHERE id = $1`, [createdAuthId]);
        } catch (e) { console.warn("Rollback Auth failed:", e); }
    }
    
    res.status(500).json({ error: error.message || "Lỗi hệ thống." });
  } finally {
      await dbClient.end();
  }
};