// my-medusa-store/src/modules/marketplace/models/carrier.ts

import { model } from "@medusajs/framework/utils"

export const Carrier = model.define("carrier", {
  id: model.id().primaryKey(),
  name: model.text(), // Tên hiển thị (VD: Giao Hàng Nhanh)
  
  // Mã định danh khớp với companyCode trên Blockchain
  code: model.text().unique(), // VD: "GHN", "VTP"
  
  // API Url hoặc config riêng nếu cần tích hợp API thật
  api_url: model.text().nullable(),
})