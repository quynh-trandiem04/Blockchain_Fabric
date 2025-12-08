import { model } from "@medusajs/framework/utils"

export const Seller = model.define("seller", {
  id: model.id().primaryKey(),
  name: model.text(), 
  handle: model.text().unique(),
  company_code: model.text().unique(), 
  email: model.text(),
  phone: model.text().nullable(),
  
  // MỚI: Trạng thái duyệt
  // pending: Chờ duyệt | approved: Đã duyệt | rejected: Từ chối
  status: model.enum(["pending", "approved", "rejected"]).default("pending"),
  
  // Mapping với User ID của Medusa
  admin_user_id: model.text().nullable(), 
})