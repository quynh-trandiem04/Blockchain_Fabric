// my-medusa-store/src/api/middlewares.ts

import { defineMiddlewares } from "@medusajs/medusa";
import { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http";
import { Modules } from "@medusajs/utils";

const ALLOWED_ADMIN_ROLES = ['ecommerceplatformorgmsp'];

// CHỈ CHẶN CÁC API DỮ LIỆU
const PROTECTED_API_ROUTES = [
    '/admin/orders',
    '/admin/products',
    '/admin/customers',
    '/admin/users',
    '/admin/sales-channels'
];

const protectApiData = async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
  const path = req.path;
  
  // 1. CHỈ QUAN TÂM ROUTE BẮT ĐẦU BẰNG /admin (API)
  if (!path.startsWith('/admin')) {
      return next();
  }

  // 2. CHO QUA CÁC ROUTE AN TOÀN
  if (path.includes('/fabric') || path.includes('/auth') || path.includes('/users/me')) {
      return next();
  }

  // 3. LẤY USER TỪ SESSION
  const actorId = (req as any).auth_context?.actor_id || (req as any).user?.id;
  if (!actorId) return next();

  try {
    // Check quyền trong DB
    const userModuleService = req.scope.resolve(Modules.USER);
    const user = await userModuleService.retrieveUser(actorId, { select: ["id", "email", "metadata"] });
    if (!user) return next();

    const role = (user.metadata?.fabric_role as string || "").toLowerCase();
    const email = (user.email || "").toLowerCase();
    const isAdmin = ALLOWED_ADMIN_ROLES.includes(role);

    if (isAdmin) return next();

    // 4. NẾU LÀ SELLER MÀ GỌI API DỮ LIỆU -> CHẶN
    // Đây là chốt chặn cuối cùng (Backend)
    if (PROTECTED_API_ROUTES.some(r => path.startsWith(r))) {
        console.log(`⛔ [MIDDLEWARE BLOCKED API] ${email} -> ${path}`);
        res.status(403).json({ message: "Forbidden: Access Denied for Non-Admin" });
        return;
    }
    
    next();
  } catch (error) {
    next();
  }
};

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/:path*", 
      method: ["GET", "POST", "PUT", "DELETE"],
      middlewares: [protectApiData],
    }
  ],
});