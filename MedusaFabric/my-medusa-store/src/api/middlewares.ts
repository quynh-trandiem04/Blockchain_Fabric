// src/api/middlewares.ts

import { defineMiddlewares } from "@medusajs/medusa";
import { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";
import { NextFunction } from "express";

const ALLOWED_ADMIN_ROLES = ['ecommerceplatformorgmsp']; 
const SELLER_ROLE = 'sellerorgmsp';

const PROTECTED_API_ROUTES = [
    '/admin/orders',
    '/admin/products',
    '/admin/customers',
    '/admin/users',
    '/admin/sales-channels'
];

const assignSellerOnCreate = async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    if (req.method !== 'POST' || !req.path.startsWith('/admin/products')) {
        return next();
    }

    const actorId = (req as any).auth_context?.actor_id || (req as any).user?.id;
    if (!actorId) return next();

    try {
        const userModuleService = req.scope.resolve(Modules.USER);
        const user = await userModuleService.retrieveUser(actorId, { select: ["id", "metadata"] });

        if (user && user.metadata?.fabric_role === SELLER_ROLE && user.metadata?.company_code) {
            
            console.log(`🛒 [Middleware] Auto-assigning product to Seller: ${user.metadata.company_code}`);
            
            // [FIX LỖI TẠI ĐÂY]: Ép kiểu req thành any để truy cập body
            const requestBody = (req as any).body || {};
            
            (req as any).body = {
                ...requestBody,
                metadata: {
                    ...(requestBody.metadata || {}),
                    seller_company_id: user.metadata.company_code,
                    seller_user_id: user.id
                }
            };
        }
    } catch (e) {
        console.error("Auto-assign error:", e);
    }
    next();
};

const protectApiData = async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
  const path = req.path;
  
  if (!path.startsWith('/admin')) return next();

  if (path.includes('/fabric') || path.includes('/auth') || path.includes('/users/me')) {
      return next();
  }

  const actorId = (req as any).auth_context?.actor_id || (req as any).user?.id;
  if (!actorId) return next(); 

  try {
    const userModuleService = req.scope.resolve(Modules.USER);
    const user = await userModuleService.retrieveUser(actorId, { select: ["id", "email", "metadata"] });
    if (!user) return next();

    const role = (user.metadata?.fabric_role as string || "").toLowerCase();
    const isAdmin = ALLOWED_ADMIN_ROLES.includes(role);
    const isSeller = role === SELLER_ROLE;

    console.log(`🛡️ Middleware Check: ${user.email} | Role: ${role} | Method: ${req.method} | Path: ${path}`);

    if (isAdmin) return next();

    if (isSeller && path === '/admin/products' && req.method === 'POST') {
        return next(); 
    }
    
    if (PROTECTED_API_ROUTES.some(r => path.startsWith(r))) {
        console.log(`⛔ [BLOCKED] Access Denied for ${user.email}`);
        res.status(403).json({ message: "Forbidden: Access Denied for Non-Admin" });
        return;
    }
    
    next();
  } catch (error) {
    console.error("Middleware Error:", error);
    next();
  }
};

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/:path*", 
      method: ["GET", "POST", "PUT", "DELETE"],
      middlewares: [assignSellerOnCreate, protectApiData],
    },
    {
      matcher: "/store/market/seller-me",
      method: "GET",
      middlewares: [], 
      auth: false, // Bypass Auth
    },
    {
      // Áp dụng cho tất cả các route fabric
      matcher: "/store/fabric/*",
      method: ["POST", "GET", "OPTIONS"], // Áp dụng cho cả OPTIONS
      middlewares: [
        // Middleware xử lý CORS cho OPTIONS request
        (req: MedusaRequest, res: MedusaResponse, next: NextFunction) => {
          // Xử lý CORS headers cho mọi request (bao gồm cả POST/GET sau này)
          const origin = (req.headers.origin as string) || "*";
          
          res.set("Access-Control-Allow-Origin", origin);
          res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
          res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-publishable-api-key, X-Requested-With");
          res.set("Access-Control-Allow-Credentials", "true");

          // Nếu là OPTIONS request -> Trả về 204 ngay lập tức
          if (req.method === "OPTIONS") {
            res.sendStatus(204);
            return;
          }
          next();
        },
      ],
      // 🔥 QUAN TRỌNG: Tắt Authentication của Medusa framework cho route này
      // Để ta tự xử lý Auth trong route handler hoặc middleware riêng
      auth: false, 
    },
  ],
});