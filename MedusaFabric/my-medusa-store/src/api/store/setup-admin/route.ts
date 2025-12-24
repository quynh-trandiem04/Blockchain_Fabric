// src/api/store/setup-admin/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";
import { Client } from "pg";

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  // Nhận Email & Pass từ Body
  const { email, password } = req.body as any;

  if (!email || !password) {
    return res.status(400).json({ error: "Thiếu email hoặc password" });
  }

  const container = req.scope;
  const userModuleService = container.resolve(Modules.USER);
  const remoteLink = container.resolve("remoteLink");

  const host = req.get("host");
  const protocol = req.protocol;
  const baseUrl = `${protocol}://${host}`;

  const dbClient = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    await dbClient.connect();

    // 1. Kiểm tra xem user đã tồn tại chưa
    const existingUsers = await userModuleService.listUsers({ email }, { take: 1 });
    if (existingUsers.length > 0) {
        return res.status(400).json({ error: "User này đã tồn tại!" });
    }

    console.log(`🚀 Creating Super Admin: ${email}...`);

    // 2. Gọi API Auth chuẩn để đăng ký (Tự động Hash Password)
    const authRes = await fetch(`${baseUrl}/auth/user/emailpass/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });

    if (!authRes.ok) {
        throw new Error(await authRes.text());
    }

    // 3. Lấy Auth ID từ DB (do API trên không trả về ID trực tiếp trong một số phiên bản)
    await new Promise(r => setTimeout(r, 500)); // Đợi DB commit
    
    const sqlRes = await dbClient.query(
        `SELECT auth_identity_id FROM provider_identity WHERE entity_id = $1`,
        [email]
    );

    if (sqlRes.rows.length === 0) throw new Error("Không tìm thấy Auth Identity");
    const authIdentityId = sqlRes.rows[0].auth_identity_id;

    // 4. Tạo User Profile với quyền ADMIN CAO NHẤT
    const user = await userModuleService.createUsers({
        email,
        first_name: "Thu",
        last_name: "Quynh",
        metadata: {
            // Role này giúp vượt qua RoleGuardWidget
            fabric_role: "ecommerceplatformorgmsp", 
            company_code: "MEDUSA_PLATFORM"
        }
    });

    // 5. Link User <-> Auth
    await remoteLink.create([
        {
            [Modules.USER]: { user_id: user.id },
            [Modules.AUTH]: { auth_identity_id: authIdentityId },
        },
    ]);

    console.log("Admin created successfully!");
    res.json({ message: "Tạo Admin thành công", user_id: user.id });

  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  } finally {
    await dbClient.end();
  }
};