// my-medusa-store/src/links/marketplace-links.ts

import { defineLink } from "@medusajs/framework/utils"
import MarketplaceModule from "../modules/marketplace"
import ProductModule from "@medusajs/medusa/product"
import OrderModule from "@medusajs/medusa/order"

// 1. Liên kết: Product thuộc về Seller
// (Mỗi Product có 1 Seller, Mỗi Seller có nhiều Product)
export const ProductSellerLink = defineLink(
  ProductModule.linkable.product,
  MarketplaceModule.linkable.seller
)

// 2. Liên kết: Order thuộc về Seller (Cho các đơn hàng con đã tách)
export const OrderSellerLink = defineLink(
  OrderModule.linkable.order,
  MarketplaceModule.linkable.seller
)

// 3. Liên kết: Order thuộc về Carrier (Đơn vị vận chuyển)
export const OrderCarrierLink = defineLink(
  OrderModule.linkable.order,
  MarketplaceModule.linkable.carrier
)