// src/api/auth/user/emailpass/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";
import jwt from "jsonwebtoken";

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { email, password } = req.body as any;

  console.log("==========================================");
  console.log(`🚀 [Login Debug] Request login for: ${email}`);

  const authModuleService = req.scope.resolve(Modules.AUTH);
  const userModuleService = req.scope.resolve(Modules.USER);

  try {
    // 1. Kiểm tra User tồn tại (Giữ nguyên)
    const users = await userModuleService.listUsers({ email: email });
    
    if (users.length === 0) {
        return res.status(404).json({ message: "User not found" });
    }
    const user = users[0];
    console.log(`✅ [Login Debug] User ID: ${user.id}`);

    // 2. Gọi Auth Module
    // 🔥 FIX LỖI TẠI ĐÂY: Đổi 'identifier' thành 'email' 🔥
    const authPayload = await authModuleService.authenticate("emailpass", {
      url: req.url,
      headers: req.headers as Record<string, string>,
      body: { 
          email: email, // <--- SỬA THÀNH 'email' (Thay vì 'identifier')
          password: password 
      },
      query: {},
      protocol: req.protocol,
    });

    if (!authPayload.success) {
        console.error(`❌ [Login Debug] Auth Failed Details:`, JSON.stringify(authPayload.error));
        return res.status(401).json({ message: "Password verification failed", details: authPayload.error });
    }
    
    if (!authPayload.authIdentity) {
        return res.status(401).json({ message: "Identity missing" });
    }

    console.log(`✅ [Login Debug] Password Correct.`);

    // 3. Tạo Token (Giữ nguyên)
    const jwtSecret = process.env.JWT_SECRET || "supersecret";
    
    const token = jwt.sign(
      {
        actor_id: user.id, 
        actor_type: "user",
        auth_identity_id: authPayload.authIdentity.id,
        app_metadata: {},
        user_metadata: {},
      },
      jwtSecret,
      { expiresIn: "24h" }
    );

    console.log(`🎟️ [Login Debug] Token Generated!`);
    return res.json({ token });

  } catch (error: any) {
    console.error("🔥 [Login Debug] Exception:", error);
    return res.status(500).json({ message: "Internal Server Error", details: error.message });
  }
};