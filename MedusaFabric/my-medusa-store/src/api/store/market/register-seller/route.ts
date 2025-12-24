// my-medusa-store/src/api/store/market/register-seller/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";
import { Client } from "pg"; 

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
    const { email, password, business_name, phone } = req.body as any;
  const container = req.scope;

  const userModuleService = container.resolve(Modules.USER);
  const marketplaceService = container.resolve("marketplace") as any;
  const remoteLink = container.resolve("remoteLink");
  const authService = container.resolve(Modules.AUTH);

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

    // 1. Kiểm tra email
    const existingUsers = await userModuleService.listUsers({ email }, { take: 1 });
    if (existingUsers.length > 0) {
        return res.status(400).json({ error: "Email đã tồn tại" });
    }

    // 2. Gọi API Đăng ký chuẩn (Để hệ thống tự Hash và lưu vào provider_identity)
    console.log("1. Calling Internal Auth Register API...");
    
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

    // 3. [FIX CHÍNH XÁC] Lấy Auth ID từ bảng provider_identity
    // Email được lưu trong bảng này, và nó trỏ về auth_identity_id
    console.log("2. Fetching Auth ID via SQL (Provider Table)...");
    
    // Chờ 500ms để DB kịp commit dữ liệu từ API trên
    await new Promise(r => setTimeout(r, 500));

    const sqlRes = await dbClient.query(
        `SELECT auth_identity_id 
         FROM provider_identity 
         WHERE entity_id = $1 
         AND provider = 'emailpass'`,
        [email]
    );

    if (sqlRes.rows.length === 0) {
        // Fallback: Nếu không tìm thấy, có thể do độ trễ hoặc tên bảng khác
        // Ta thử tìm auth_identity mới nhất được tạo (Rủi ro thấp trong môi trường dev)
        console.warn("   -> Direct lookup failed, trying fallback (Latest Auth)...");
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

    // 4. Tạo User Profile
    console.log("3. Creating User Profile...");
    const user = await userModuleService.createUsers({
        email,
        metadata: {
            fabric_role: "sellerorgmsp",
            company_code: `Shop_${Date.now()}`, 
            approver_status: "pending",
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

    // 6. Tạo Seller Profile
    console.log("5. Creating Seller Profile...");
    const seller = await marketplaceService.createSellers({
            name: business_name,
            handle: business_name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]/g, ''),
        company_code: user.metadata?.company_code,
        email: email,
        phone: phone,
        status: "pending",
        admin_user_id: user.id
    });

    res.json({ message: "Đăng ký thành công! Vui lòng chờ Admin phê duyệt.", seller_id: seller.id });

  } catch (error: any) {
        console.error(" Register Error:", error);
    
    // Rollback
    if (createdUserId) await userModuleService.deleteUsers([createdUserId]);
    if (createdAuthId) {
        try {
             // Xóa cascade bằng SQL để sạch sẽ
             await dbClient.query(`DELETE FROM provider_identity WHERE auth_identity_id = $1`, [createdAuthId]);
             await dbClient.query(`DELETE FROM auth_identity WHERE id = $1`, [createdAuthId]);
        } catch (e) { console.warn("Rollback Auth failed:", e); }
    }
    
    res.status(500).json({ error: error.message || "Lỗi hệ thống." });
  } finally {
      await dbClient.end();
  }
};