// my-medusa-store\medusa-config.ts

import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS || "http://localhost:8000",
      adminCors: process.env.ADMIN_CORS || "http://localhost:7000,http://localhost:7001",
      authCors: process.env.AUTH_CORS || "http://localhost:8000",
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    }
  },
  modules: [
    {
      resolve: "./src/modules/marketplace",
      key: "marketplace", 
    },
    // 👇 CẤU HÌNH PAYMENT ĐƠN GIẢN (Chỉ dùng provider có sẵn)
    {
      resolve: "@medusajs/payment",
      options: {
      providers: [
        {
            // Trỏ vào module local chứa cả 2 provider
            resolve: "./src/modules/simple-payment",
          id: "pp_system_default",
            options: { name: "Manual Payment" }
          },
          {
            // Vẫn trỏ vào cùng module đó, nhưng dùng ID khác
            resolve: "./src/modules/simple-payment",
            id: "pp_cod", 
            options: { name: "Ship COD" }
          }
      ],
      },
    },
  ]
})