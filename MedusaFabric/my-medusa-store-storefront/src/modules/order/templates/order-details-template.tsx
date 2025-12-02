// my-medusa-store-storefront/src/modules/order/templates/order-details-template.tsx

"use client"

import { XMark } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Help from "@modules/order/components/help"
import Items from "@modules/order/components/items"
import OrderSummary from "@modules/order/components/order-summary"
import ShippingDetails from "@modules/order/components/shipping-details"
import React, { useState, useEffect } from "react"
import { Button, Heading, Text, Badge } from "@medusajs/ui"

type OrderDetailsTemplateProps = {
  order: HttpTypes.StoreOrder
}

const OrderDetailsTemplate: React.FC<OrderDetailsTemplateProps> = ({
  order,
}) => {
  const [chainStatus, setChainStatus] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [isReturning, setIsReturning] = useState(false);
  const [loadingText, setLoadingText] = useState("Đang tải...");

  const publishableApiKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;

  // 1. Fetch Status
  useEffect(() => {
      const fetchStatus = async () => {
          try {
             const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";
             
             const res = await fetch(`${BACKEND_URL}/store/fabric/orders/${order.id}/status`, {
                 headers: {
                     "x-publishable-api-key": publishableApiKey || "",
                     "Content-Type": "application/json"
                 }
             });
             
             if (res.ok) {
                 const data = await res.json();
                 setChainStatus(data.status);
                 setPaymentMethod(data.paymentMethod);
                 setLoadingText(""); 
             } else {
                 console.warn("Blockchain fetch failed:", res.status);
                 setChainStatus(null);
                 setLoadingText(res.status === 404 ? "Chưa đồng bộ" : "Lỗi tải dữ liệu");
             }
          } catch (e) { 
             console.error("Network Error:", e);
             setLoadingText("Lỗi kết nối");
          }
      };
      
      if (order?.id) fetchStatus();
  }, [order.id, publishableApiKey]);

  // 2. Handle Return
  const handleRequestReturn = async () => {
      if (!confirm("Confirm return request?")) return;

      setIsReturning(true);
      try {
          const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";
          
          const res = await fetch(`${BACKEND_URL}/store/fabric/orders/${order.id}/return`, {
              method: "POST",
              headers: { 
                  "Content-Type": "application/json",
                  "x-publishable-api-key": publishableApiKey || "" 
              }
          });

          const result = await res.json();

          if (res.ok) {
            //   alert(" Thành công! Yêu cầu trả hàng đã được ghi nhận.");
              window.location.reload(); 
          } else {
            //   alert(" Lỗi: " + (result.error || "Không thể trả hàng"));
          }
      } catch (err) {
        //   alert("Lỗi kết nối đến máy chủ.");
      } finally {
          setIsReturning(false);
      }
  };

  // Helper chọn màu Badge
  const getStatusColor = (status: string) => {
    const s = (status || "").toUpperCase();

    switch (s) {
        default:
        return { bg: '#F9FAFB', color: '#6B7280', border: '#E5E7EB' };
    }
  };

  return (
    <div className="flex flex-col justify-center gap-y-4">
      <div className="flex gap-2 justify-between items-center">
        <h1 className="text-2xl-semi">Order details</h1>
        <LocalizedClientLink href="/account/orders" className="flex gap-2 items-center text-ui-fg-subtle hover:text-ui-fg-base">
          <XMark /> Back to overview
        </LocalizedClientLink>
      </div>
      
      <div className="flex flex-col gap-4 h-full bg-white w-full" data-testid="order-details-container">
        
        <div className="flex flex-col gap-y-2 border-b border-gray-200 pb-4">
             <div className="flex flex-col">
                 <span className="text-ui-fg-base text-xl font-bold">Order number: {order.display_id}</span>
                 <span className="text-ui-fg-subtle text-sm">
                     Order date: {new Date(order.created_at).toDateString()}
                 </span>
             </div>
             
             {/* HIỂN THỊ STATUS TỪ BLOCKCHAIN */}
             <div className="flex gap-x-4 mt-2 items-center text-sm text-gray-700">
                 <div className="flex items-center gap-1">
                     Order status: 
                {chainStatus ? (
                         <Badge color={getStatusColor(chainStatus)}>{chainStatus}</Badge>
                ) : (
                         <span className="italic text-gray-400">Syncing...</span>
                     )}
                 </div>
                 <div className="flex items-center gap-1">
                     Payment status: 
                     {paymentMethod ? (
                         <span className="font-medium uppercase text-gray-900">{paymentMethod}</span>
                     ) : (
                         <span>{order.payment_status}</span> // Fallback về Medusa nếu chưa có chain
                     )}
                 </div>
             </div>
            </div>

        {/* Ẩn OrderDetails cũ đi hoặc bỏ prop showStatus */}
        {/* <OrderDetails order={order} showStatus={false} /> */} 
        
        {/* --- NÚT TRẢ HÀNG (Chỉ hiện khi cần) --- */}
            {chainStatus === 'DELIVERED' && (
            <div className="p-4 bg-red-50 border border-red-100 rounded flex justify-between items-center">
                <Text className="text-sm text-red-800">You can request a return within 7 days.</Text>
                <Button variant="danger" size="small" onClick={handleRequestReturn} isLoading={isReturning}>
                    Return Request
                    </Button>
                </div>
            )}

            {/* TRẠNG THÁI ĐÃ YÊU CẦU */}
            {chainStatus === 'RETURN_REQUESTED' && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm text-center flex items-center justify-center gap-2">
                <span></span> Your return request is being processed.
            </div>
        )}

        {/* --- TRẠNG THÁI ĐÃ TRẢ THÀNH CÔNG --- */}
        {chainStatus === 'RETURNED' && (
            <div className="p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm text-center flex items-center justify-center gap-2">
                <span></span> The return has been completed. Your refund will be issued soon.
                </div>
            )}

        <Items order={order} />
        <ShippingDetails order={order} />
        <OrderSummary order={order} />
        <Help />
      </div>
    </div>
  )
}

export default OrderDetailsTemplate