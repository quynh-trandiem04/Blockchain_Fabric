// src/subscribers/assign-seller-to-product.ts

import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";

// [FIX LỖI 1]: Xóa import bị lỗi
// import { ProductService } from "@medusajs/medusa"; 

export default async function assignSellerToProduct({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  
  const productId = data.id;
  
  // [FIX LỖI 2]: Ép kiểu 'as any'
  const productService = container.resolve("productService") as any;
  const marketplaceService = container.resolve("marketplace") as any;
  const remoteLink = container.resolve("remoteLink");

  try {
    const product = await productService.retrieve(productId);

    const companyCode = product.metadata?.seller_company_id;

    if (!companyCode) {
      console.log(`[Subscriber] Product ${productId} không có Seller. Bỏ qua.`);
      return;
    }

    console.log(`[Subscriber] Tìm thấy Product của Seller: ${companyCode}. Đang tạo Link...`);

    const sellers = await marketplaceService.listSellers({
        company_code: companyCode
    });

    if (!sellers || sellers.length === 0) {
        console.warn(`⚠️ Không tìm thấy Seller nào có mã: ${companyCode}`);
        return;
    }

    const seller = sellers[0];

    await remoteLink.create([
      {
        [Modules.PRODUCT]: { product_id: productId },
        "marketplace": { seller_id: seller.id }
      }
    ]);

    console.log(`✅ Đã liên kết Product ${productId} <-> Seller ${seller.id}`);

  } catch (error) {
    console.error(`❌ Lỗi trong subscriber assign-seller:`, error);
  }
}

export const config: SubscriberConfig = {
  event: "product.created",
};