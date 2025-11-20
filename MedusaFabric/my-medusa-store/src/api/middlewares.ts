import { defineMiddlewares } from "@medusajs/medusa";
import { authenticate } from "@medusajs/framework/http";

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/fabric/*",
      middlewares: [
        // Bắt buộc xác thực User (Admin) bằng Token Bearer hoặc Session
        authenticate("user", ["bearer", "session"]),
      ],
    },
  ],
});