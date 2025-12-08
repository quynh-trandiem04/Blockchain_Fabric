// my-medusa-store-storefront/src/app/[countryCode]/(checkout)/checkout/page.tsx

import { Metadata } from "next"
import { notFound } from "next/navigation"
import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import PaymentWrapper from "@modules/checkout/components/payment-wrapper"
import CheckoutSummary from "@modules/checkout/templates/checkout-summary" // Import thêm Summary

// Import Component vừa tạo ở Bước 1
import CheckoutFlow from "@modules/checkout/templates/checkout-flow" 

export const metadata: Metadata = {
  title: "Checkout",
}

export default async function Checkout() {
  const cart = await retrieveCart()

  if (!cart) {
    return notFound()
  }

  const customer = await retrieveCustomer()

  return (
    <div className="grid grid-cols-1 small:grid-cols-[1fr_416px] content-container gap-x-40 py-12">
      {/* Cột Trái: Luồng Checkout (Form + Chọn Carrier + Nút) */}
      <PaymentWrapper cart={cart}>
        <CheckoutFlow cart={cart} customer={customer} />
      </PaymentWrapper>

      {/* Cột Phải: Tóm tắt giỏ hàng (Tổng tiền) */}
      <div className="relative">
        <CheckoutSummary cart={cart} />
      </div>
    </div>
  )
}