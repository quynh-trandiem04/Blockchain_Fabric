// src/modules/checkout/templates/checkout-flow/index.tsx

"use client"

import { useState } from "react"
import { Button } from "@medusajs/ui"
import { useRouter } from "next/navigation"
// [FIX 1]: Xóa import từ '@medusajs/medusa' vì gói này không có ở Storefront. 
// Dùng 'any' hoặc import type từ 'medusa-react' nếu có. Ở đây dùng 'any' cho đơn giản và chắc chắn chạy được.

// Import các component con
import ShippingCarrier from "@modules/checkout/components/shipping-carrier"
// [FIX 2]: Xóa CheckoutLoader vì file này không tồn tại, thay bằng div đơn giản
// import CheckoutLoader from "@modules/checkout/components/checkout-loader"

import Addresses from "@modules/checkout/components/addresses"
import Shipping from "@modules/checkout/components/shipping"
import Payment from "@modules/checkout/components/payment"
import Review from "@modules/checkout/components/review"

// [FIX 1]: Định nghĩa lại Props dùng 'any' để bypass lỗi thiếu Type
type CheckoutFlowProps = {
  cart: any
  customer: any
}

const CheckoutFlow = ({ cart, customer }: CheckoutFlowProps) => {
  const router = useRouter()
  const [selectedCarrier, setSelectedCarrier] = useState("GHN")
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  
  const handlePlaceOrder = async () => {
    if (!cart) return
    setIsPlacingOrder(true)

    try {
      const backendUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
      
      // 1. Cập nhật Metadata Cart
      await fetch(`${backendUrl}/store/carts/${cart.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
              metadata: { shipper_code: selectedCarrier }
          })
      })

      // 2. Gọi API Hoàn tất đơn hàng
      const res = await fetch(`${backendUrl}/store/market/complete-cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart_id: cart.id }),
      })

      if (res.ok) {
        const data = await res.json()
        router.push(`/order/confirmed/${data.order.id}`)
      } else {
        const err = await res.json()
        alert(`Lỗi đặt hàng: ${err.error || "Vui lòng thử lại."}`)
      }
    } catch (e) {
      console.error(e)
      alert("Có lỗi xảy ra kết nối.")
    } finally {
      setIsPlacingOrder(false)
    }
  }

  // [FIX 2]: Thay CheckoutLoader bằng div loading đơn giản
  if (!cart) return <div className="w-full h-full flex justify-center items-center">Loading Checkout...</div>

  return (
    <div className="grid grid-cols-1 gap-y-8">
      {/* 1. Địa chỉ */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
         <Addresses cart={cart} customer={customer} />
      </div>

      {/* 2. Phương thức giao hàng (Của Medusa) */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
         {/* [FIX 3]: Truyền thêm availableShippingMethods. 
             Ta truyền mảng rỗng [] hoặc cart.shipping_methods vì ta đã có component ShippingCarrier riêng bên dưới xử lý việc chọn GHN/VTP rồi.
         */}
         <Shipping 
            cart={cart} 
            availableShippingMethods={cart.shipping_methods || []} 
         />
      </div>

      {/* 3. [CUSTOM] Chọn Đơn vị vận chuyển (GHN/VTP) */}
      <ShippingCarrier 
        selectedCarrier={selectedCarrier} 
        setCarrier={setSelectedCarrier} 
      />

      {/* 4. Thanh toán */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
         {/* [FIX 4]: Truyền thêm availablePaymentMethods lấy từ cart.payment_sessions */}
         <Payment 
            cart={cart} 
            availablePaymentMethods={cart.payment_sessions || []}
         />
      </div>

      {/* 5. Review */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
         <Review cart={cart} />
      </div>

      {/* 6. Nút Đặt Hàng */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 shadow-lg rounded-t-lg z-50">
         <Button 
            size="large"
            className="w-full text-lg font-bold"
            onClick={handlePlaceOrder} 
            isLoading={isPlacingOrder} 
            disabled={!cart.shipping_address || !cart.billing_address || !cart.email}
         >
            ĐẶT HÀNG ({selectedCarrier})
         </Button>
      </div>
    </div>
  )
}

export default CheckoutFlow