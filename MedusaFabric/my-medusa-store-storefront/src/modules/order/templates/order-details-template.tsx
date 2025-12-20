// my-medusa-store-storefront/src/modules/order/templates/order-details-template.tsx

"use client"

import { XMark } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Help from "@modules/order/components/help"
import OrderSummary from "@modules/order/components/order-summary"
import ShippingDetails from "@modules/order/components/shipping-details"
import React, { useState, useEffect, useMemo } from "react"
import { Button, Heading, Text, Container, clx } from "@medusajs/ui"

type OrderDetailsTemplateProps = {
  order: HttpTypes.StoreOrder
}

// --- Component con: Hiển thị danh sách sản phẩm (Monochrome) ---
const PackageItems = ({ items, currencyCode }: { items: any[], currencyCode: string }) => {
    if (!items || items.length === 0) {
        return <div className="mt-4 text-xs text-gray-400 italic">No items display for this package info.</div>;
    }

    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode.toUpperCase() }).format(amount);
    };

    return (
        <div className="mt-5 border-t-2 border-gray-100 pt-4 font-mono">
            <Text className="font-bold text-black mb-4 uppercase text-[10px] tracking-widest border-l-4 border-black pl-2">
                Items in Package
            </Text>
            <div className="flex flex-col gap-4">
                {items.map((item) => (
                    <div key={item.id} className="flex gap-4 items-start group">
                        <div className="h-16 w-16 border border-gray-200 bg-white shrink-0 relative overflow-hidden p-1">
                            {item.thumbnail ? (
                                <img 
                                    src={item.thumbnail} 
                                    alt={item.title} 
                                    className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105" 
                                />
                            ) : (
                                <div className="h-full w-full flex items-center justify-center text-gray-300 text-xs bg-gray-50">IMG</div>
                            )}
                        </div>
                        <div className="flex-1 flex flex-col justify-between py-0.5">
                            <div>
                                <div className="flex justify-between items-start mb-1">
                                    <Text className="text-gray-900 font-bold text-sm line-clamp-1">{item.title}</Text>
                                    <Text className="text-gray-900 font-bold text-sm ml-4 text-right">
                                        {formatMoney(item.unit_price * item.quantity)}
                                    </Text>
                                </div>
                                <Text className="text-gray-500 text-[10px] uppercase tracking-wide">
                                    {item.variant_title || "Standard"}
                                </Text>
                            </div>
                            <div className="flex justify-between items-end mt-1 text-xs text-gray-500 font-medium">
                                <span className="bg-white border border-gray-300 px-2 py-0.5 text-[10px] text-black">
                                    x{item.quantity}
                                </span>
                                <span className="text-[10px] text-gray-400">
                                    {formatMoney(item.unit_price)} / ea
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const OrderDetailsTemplate: React.FC<OrderDetailsTemplateProps> = ({
  order,
}) => {
  const [subOrders, setSubOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReturning, setIsReturning] = useState<string | null>(null);

  const publishableApiKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;
  const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";

  // 1. Fetch Sub-Orders Status
  useEffect(() => {
      const fetchBlockchainData = async () => {
          if (!order.id) return;
          try {
              const res = await fetch(`${BACKEND_URL}/store/fabric/orders/${order.id}/sub-orders`, {
                 headers: {
                     "x-publishable-api-key": publishableApiKey || "",
                     "Content-Type": "application/json"
                 }
             });
             
             if (res.ok) {
                 const data = await res.json();
                  setSubOrders(data.sub_orders || []);
             } else {
                 console.warn("Blockchain fetch failed:", res.status);
             }
          } catch (e) { 
             console.error("Network Error:", e);
          } finally {
             setLoading(false);
          }
      };
      fetchBlockchainData();
  }, [order.id, publishableApiKey, BACKEND_URL]);

  // 2. Logic Lọc Items từ DB (Medusa Order) theo Seller ID của SubOrder
  const getItemsForSubOrder = (sellerId: string) => {
      if (!order.items) return [];
      
      return order.items.filter((item: any) => {
          // Lấy seller_company_id từ metadata của Product hoặc Variant
          // (Cần đảm bảo logic lưu metadata lúc tạo sản phẩm khớp với dòng này)
          const productSellerId = item.variant?.product?.metadata?.seller_company_id || item.metadata?.seller_company_id;
          
          return productSellerId === sellerId;
      });
  };

  // 3. Handle Return Request
    const handleRequestReturn = async (subOrderId: string) => {
      if (!confirm("Confirm return request for this package?")) return;

      setIsReturning(subOrderId);
      try {
          const res = await fetch(`${BACKEND_URL}/store/fabric/orders/${subOrderId}/return`, {
              method: "POST",
              headers: { 
                  "Content-Type": "application/json",
                  "x-publishable-api-key": publishableApiKey || "" 
              }
          });

          const result = await res.json();

          if (res.ok) {
              alert("Success! Return request submitted.");
              window.location.reload(); 
          } else {
              // Hiển thị lỗi từ Backend (VD: Hết hạn trả hàng)
              alert("Error: " + (result.error || "Có lỗi xảy ra"));
          }
      } catch (err) {
        //   alert("Lỗi kết nối đến máy chủ.");
      } finally {
          setIsReturning(null);
      }
  };

  // Helper Badge Style
  const getStatusBadgeStyle = (status: string) => {
    const s = (status || "").toUpperCase();
    const base = "uppercase font-mono text-[10px] px-2 py-0.5 border tracking-wider transition-colors";
    
    if (['DELIVERED', 'SETTLED', 'RETURNED'].includes(s)) {
        return clx(base, "bg-black text-white border-black");
    }
    if (['RETURN_REQUESTED', 'RETURN_IN_TRANSIT'].includes(s)) {
        return clx(base, "bg-gray-200 text-black border-gray-400 font-bold");
    }
    return clx(base, "bg-white text-gray-500 border-gray-300");
  };

  return (
    <div className="flex flex-col justify-center gap-y-4">
      {/* Header Navigation */}
      <div className="flex gap-2 justify-between items-center font-mono border-b border-gray-200 pb-4 mb-2">
        <div>
            <h1 className="text-2xl uppercase tracking-tighter font-black text-black">Order #{order.display_id}</h1>
            <span className="text-gray-500 text-xs uppercase tracking-wide">
                 {new Date(order.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
            </span>
        </div>
        <LocalizedClientLink href="/account/orders" className="flex gap-2 items-center text-gray-400 hover:text-black uppercase text-xs font-bold transition-colors">
          <XMark className="w-4 h-4"/> Close
        </LocalizedClientLink>
      </div>
      
      <div className="flex flex-col gap-8 h-full bg-white w-full font-mono" data-testid="order-details-container">
             
        {/* --- BLOCKCHAIN TRACKING SECTION --- */}
        <div>
            <Heading level="h2" className="text-sm font-bold mb-4 flex items-center gap-2 uppercase tracking-widest text-gray-400">
                Package Tracking & Shipments
            </Heading>

            {loading ? (
                <div className="p-8 border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400 text-center uppercase tracking-widest">Synchronizing blockchain ledger...</div>
            ) : subOrders.length === 0 ? (
                <div className="p-8 border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400 text-center uppercase">Tracking info unavailable.</div>
            ) : (
                <div className="flex flex-col gap-6">
                    {subOrders.map((sub, index) => (
                        // ITEM FILTERING HAPPENS HERE
                        <Container key={sub.blockchain_id} className="p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white rounded-none transition-transform hover:-translate-y-0.5">
                            
                            {/* HEADER */}
                            <div className="flex flex-col md:flex-row md:justify-between md:items-start mb-6 border-b-2 border-gray-100 pb-4 gap-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="uppercase font-black text-sm bg-black text-white px-3 py-1">
                                            PKG #{index + 1}
                                        </span>
                                        <span className="text-[10px] text-gray-400 tracking-tight font-mono">{sub.blockchain_id}</span>
                 </div>
                                    <Text className="text-xs text-gray-500 uppercase tracking-wide">
                                        Sold by <span className="font-bold text-black border-b border-gray-300">{sub.seller_id}</span>
                                    </Text>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className="text-[9px] text-gray-400 uppercase tracking-widest">Status</span>
                                    <span className={getStatusBadgeStyle(sub.status)}>
                                    {sub.status.replace(/_/g, ' ')}
                                    </span>
                                </div>
                            </div>

                            {/* INFO GRID */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm text-gray-700 mb-2">
                                <div>
                                    <p className="text-gray-400 text-[9px] uppercase font-bold mb-1 tracking-wider">Carrier</p>
                                    <p className="font-bold text-black truncate uppercase text-xs" title={sub.shipper_id}>{sub.shipper_id}</p>
                                </div>
                                <div>
                                    <p className="text-gray-400 text-[9px] uppercase font-bold mb-1 tracking-wider">Updated</p>
                                    <p className="uppercase text-xs">{new Date(sub.updated_at).toLocaleDateString('en-GB')}</p>
                                    <p className="text-[10px] text-gray-400">{new Date(sub.updated_at).toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'})}</p>
                                </div>
                                <div>
                                    <p className="text-gray-400 text-[9px] uppercase font-bold mb-1 tracking-wider">Payment</p>
                                    <div className="flex flex-col items-start">
                                        <span className="font-bold text-black uppercase text-xs">{sub.payment_method}</span>
                 </div>
             </div>
                                <div>
                                    <p className="text-gray-400 text-[9px] uppercase font-bold mb-1 tracking-wider">COD Status</p>
                                    {sub.cod_status ? (
                                        <span className="text-[10px] bg-gray-100 px-2 py-0.5 text-gray-600 uppercase inline-block font-bold">
                                            {sub.cod_status.replace(/_/g, ' ')}
                                        </span>
                                    ) : <span className="text-xs text-gray-300">-</span>}
                                </div>
            </div>

                            {/* 🔥🔥 DANH SÁCH SẢN PHẨM RIÊNG BIỆT CHO GÓI NÀY 🔥🔥 */}
                            <PackageItems 
                                items={getItemsForSubOrder(sub.seller_id)} 
                                currencyCode={order.currency_code} 
                            />

                            {/* ACTIONS */}
                            {sub.status === 'DELIVERED' && (
                                <div className="border-t-2 border-gray-100 pt-5 mt-5 flex justify-end">
                                    <Button 
                                        variant="secondary"
                                        className="border border-black text-black hover:bg-black hover:text-white rounded-none uppercase font-bold text-[10px] px-6 py-2 h-auto transition-all"
                                        onClick={() => handleRequestReturn(sub.blockchain_id)} 
                                        isLoading={isReturning === sub.blockchain_id}
                                    >
                                        Request Return
                    </Button>
                </div>
            )}

                            {/* Alert Messages */}
                            {sub.status === 'RETURN_REQUESTED' && (
                                <div className="mt-4 bg-gray-50 border-l-4 border-gray-400 p-3 text-xs text-gray-600 uppercase font-medium">
                                    Return Requested. Please wait for carrier pickup.
                                </div>
                            )}
                        </Container>
                    ))}
                </div>
            )}
        </div>

        {/* --- SUMMARY SECTION --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-gray-200 pt-8 mt-4">
        <ShippingDetails order={order} />
        <OrderSummary order={order} />
        </div>
        
        <div className="border-t border-gray-200 pt-4">
        <Help />
        </div>
      </div>
    </div>
  )
}

export default OrderDetailsTemplate