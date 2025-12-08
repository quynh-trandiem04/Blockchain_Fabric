// medusa-config.ts

import { loadEnv, defineConfig } from '@medusajs/framework/utils'
const path = require("path"); // Bắt buộc có dòng này

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    }
  },
  modules: [
    {
      // Dùng path.resolve để lấy đường dẫn tuyệt đối chuẩn xác
      // __dirname trỏ đến thư mục gốc của dự án (nơi chứa medusa-config.ts)
      resolve: path.resolve(__dirname, "src/modules/marketplace"),
      key: "marketplace", 
    },
  ]
})