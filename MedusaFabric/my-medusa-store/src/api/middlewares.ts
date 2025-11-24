// src/api/middlewares.ts

import { defineMiddlewares } from "@medusajs/medusa";
import { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http";
import { Modules } from "@medusajs/utils";

// 1. ROLE ADMIN ĐƯỢC PHÉP
const ALLOWED_ADMIN_ROLES = ['ecommerceplatformorgmsp'];

// 2. DANH SÁCH CÁC MODULE CẦN BẢO VỆ
const PROTECTED_MODULES = [
    '/admin/products',
    '/admin/draft-orders',
    '/admin/product-categories',
    '/admin/product-types',
    '/admin/product-tags',
    '/admin/collections',
    '/admin/customers',
    '/admin/categories',
    '/admin/customer-groups',
    'admin/inventory',
    'admin/reservations',
    '/admin/discounts',
    '/admin/promotions',
    '/admin/campaigns',
    '/admin/pricing',
    '/admin/price-lists',
    '/admin/settings/store',
    '/admin/inventory-items',
    '/admin/stock-locations',
    '/admin/sales-channels',
    '/admin/regions',
    '/admin/tax-regions',
    '/admin/return-reasons',
    '/admin/stores',
    '/admin/api-keys',
    '/admin/users',
    '/admin/shipping-profiles',
    '/admin/fulfillment-sets',
    '/admin/invites',
    '/admin/currencies',
    '/admin/notifications'
];

// 3. WHITELIST: TUYỆT ĐỐI KHÔNG CHẶN CÁC URL NÀY
const WHITELIST_KEYWORDS = [
    '/auth',              // Đăng nhập
    '/users/me',          // Lấy profile bản thân
    '/users/password-token',
    '/admin/fabric',      // API Custom cho Shipper Dashboard
    '/app/login',         // UI Login
    '/admin/orders',
    '.css', '.js', '.png', '.jpg', '.ico', '.json', // File tĩnh
    '.woff', '.woff2'
];

const protectAdminSystem = async (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  const fullPath = req.originalUrl || req.path;

  // A. KIỂM TRA WHITELIST
  if (WHITELIST_KEYWORDS.some(keyword => fullPath.includes(keyword))) {
      return next();
  }

  // B. KIỂM TRA ĐĂNG NHẬP
  const actorId = (req as any).auth_context?.actor_id || (req as any).user?.id;
  
  if (!actorId) {
      return next();
  }

  try {
    const userModuleService = req.scope.resolve(Modules.USER);
    
    const user = await userModuleService.retrieveUser(actorId, {
        select: ["id", "email", "metadata"]
    });

    if (!user) return next();

    const userRole = (user.metadata?.fabric_role as string || "").toLowerCase();
    
    // C. NẾU LÀ ADMIN XỊN -> CHO QUA
    if (ALLOWED_ADMIN_ROLES.includes(userRole)) {
        return next();
    }

    // D. CHẶN
    console.log(`⛔ [BLOCKED] User: ${user.email} (${userRole}) -> Target: ${fullPath}`);

    if (fullPath.startsWith('/admin')) {
        res.status(403).json({
            message: "ACCESS DENIED: Role của bạn không được phép truy cập module này.",
            type: "authorization_error"
        });
    } else {
        res.status(403).send(`
            <div style="font-family:sans-serif;text-align:center;padding-top:100px;background-color:#f9f9f9;height:100vh;">
                <h1 style="color:#e11d48;font-size:48px;margin-bottom:10px;">403</h1>
                <h2 style="color:#1f2937;">TRUY CẬP BỊ TỪ CHỐI</h2>
                <p style="color:#4b5563;margin-top:20px;">Tài khoản <b>${user.email}</b> không có quyền quản trị hệ thống.</p>
                <a href="/app/login" style="display:inline-block;margin-top:30px;padding:10px 20px;background-color:#111827;color:white;text-decoration:none;border-radius:6px;">Đăng xuất</a>
            </div>
        `);
    }

  } catch (error) {
    console.error("[Middleware Error]:", error);
    next();
  }
};

// 4. TẠO ROUTES DYNAMIC
// --- SỬA LỖI: Dùng 'any[]' để TypeScript không bắt lỗi type của 'method' ---
const dynamicRoutes: any[] = []; 

PROTECTED_MODULES.forEach(path => {
    dynamicRoutes.push({
        matcher: path,
        method: ["GET", "POST", "PUT", "DELETE"],
        middlewares: [protectAdminSystem],
    });
    dynamicRoutes.push({
        matcher: `${path}/:path*`, 
        method: ["GET", "POST", "PUT", "DELETE"],
        middlewares: [protectAdminSystem],
    });
});

// Thêm matcher chặn giao diện /app (UI)
dynamicRoutes.push({
    matcher: "/app/:path*",
    method: "GET",
    middlewares: [protectAdminSystem],
});

export default defineMiddlewares({
  routes: dynamicRoutes,
});