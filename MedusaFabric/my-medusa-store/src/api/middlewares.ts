// my-medusa-store/src/api/middlewares.ts

import { defineMiddlewares } from "@medusajs/medusa";
import { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http";
import { Modules } from "@medusajs/utils";

const ALLOWED_ADMIN_ROLES = ['ecommerceplatformorgmsp'];

// Danh sách API nhạy cảm (Data)
const SENSITIVE_DATA_ROUTES = [
    '/admin/orders',
    '/admin/products',
    '/admin/customers',
    '/admin/collections',
    '/admin/users',
    '/admin/sales-channels',
    '/admin/draft-orders',
    '/admin/inventory-items',
    '/admin/stock-locations',
    '/admin/price-lists'
];

const protectApiData = async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
  const path = req.path;
  const method = req.method;

  // 1. WHITELIST CỨNG: Luôn cho qua Auth, Fabric Custom, Metadata
  if (path.includes('/admin/fabric') || path.includes('/auth') || path.includes('/users/me') ||
      path.includes('/regions') || path.includes('/stores') || path.includes('/currencies')) {
      return next();
  }

  // 2. CHECK USER
  const actorId = (req as any).auth_context?.actor_id || (req as any).user?.id;
  if (!actorId) return next();

  try {
    const userModuleService = req.scope.resolve(Modules.USER);
    const user = await userModuleService.retrieveUser(actorId, { select: ["id", "email", "metadata"] });
    if (!user) return next();

    const userRole = (user.metadata?.fabric_role as string || "").toLowerCase();
    const isAdmin = ALLOWED_ADMIN_ROLES.includes(userRole);

    // NẾU LÀ ADMIN -> CHO QUA TẤT CẢ
    if (isAdmin) return next();

    // NẾU LÀ SELLER:
    // A. Chặn tuyệt đối các method GHI (POST, PUT, DELETE) trên API nhạy cảm
    if (method !== 'GET') {
        const isSensitive = SENSITIVE_DATA_ROUTES.some(route => path.startsWith(route));
        if (isSensitive) {
            console.log(`⛔ [WRITE BLOCKED] User: ${user.email} -> Method: ${method} -> Path: ${path}`);
            res.status(403).json({ message: "Forbidden: Bạn không có quyền sửa đổi dữ liệu." });
            return;
        }
    }

    // B. Cho phép GET (Xem) để UI Admin không bị Crash.
    // Widget ở Frontend sẽ lo việc che đi giao diện này ngay lập tức.
    // (Lý do: Nếu chặn GET API ở đây, trang Draft Order sẽ crash đỏ lòm như bạn thấy, Widget ko chạy đc).
    
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