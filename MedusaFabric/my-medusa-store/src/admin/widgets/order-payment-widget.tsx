// my-medusa-store/src/admin/widgets/order-payment-widget.tsx

import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Button, Container, Heading, Text, toast, Badge } from "@medusajs/ui";
import { DetailWidgetProps, AdminOrder } from "@medusajs/framework/types";
import { useState, useEffect } from "react";

const OrderPaymentWidget = ({ data }: DetailWidgetProps<AdminOrder>) => {
  const [isLoading, setIsLoading] = useState(false);
  const [fabricStatus, setFabricStatus] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const API_BASE = "/admin/fabric/orders"; 

  const checkFabricStatus = async () => {
    try {
      console.log("Checking Fabric Status for Order ID:", data.id);
      const res = await fetch(`${API_BASE}/${data.id}/status`, {
        method: "GET",
        credentials: "include",
      });
      console.log("Fabric Status Response:", res);
      if (res.ok) {
        const json = await res.json();
        setFabricStatus(json);
        setErrorMsg("");
      } else {
        if (res.status === 404) {
             setFabricStatus(null); 
        } else if (res.status === 401) {
             setErrorMsg("Lỗi 401: Hết phiên đăng nhập");
        } else {
             setErrorMsg(`Lỗi: ${res.status}`);
        }
      }
    } catch (e) {
      console.error(e);
      setErrorMsg("Lỗi kết nối");
    }
  };

  useEffect(() => {
    checkFabricStatus();
  }, [data.id]);

  const handleConfirmPayment = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/${data.id}/confirm-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      const result = await res.json();

      if (res.ok) {
        toast.success("Thành công", { description: "Đã xác nhận thanh toán." });
        await checkFabricStatus();
      } else {
        toast.error("Lỗi", { description: result.error || "Thất bại." });
      }
    } catch (err) {
      toast.error("Lỗi kết nối");
    } finally {
      setIsLoading(false);
    }
  };

  // FIX: Nếu không có data và không có lỗi thì ẩn
  if (!fabricStatus && !errorMsg) return null;

  return (
    <Container className="divide-y p-0 border border-blue-200 shadow-sm mb-4">
      <div className="px-6 py-4 flex items-center justify-between bg-gray-50">
        <div>
          <Heading level="h2" className="text-blue-600">Blockchain Status</Heading>
          
          {/* FIX: Hiển thị errorMsg bằng component Text (đã khai báo) */}
          {errorMsg ? (
            <Text className="text-red-500 text-xs font-mono mt-1">{errorMsg}</Text>
          ) : (
            <div className="flex gap-2 mt-1">
                <Badge color={fabricStatus.status === 'PAID' ? 'green' : 'orange'}>
                    {fabricStatus.status}
                </Badge>
                <Badge>{fabricStatus.paymentMethod}</Badge>
            </div>
          )}
        </div>

        {fabricStatus && fabricStatus.paymentMethod === "PREPAID" && fabricStatus.status === "CREATED" && (
             <Button variant="secondary" onClick={handleConfirmPayment} isLoading={isLoading}>
                Xác nhận Thanh toán
            </Button>
        )}

        {fabricStatus && fabricStatus.status === "PAID" && (
             <Button disabled variant="transparent" className="text-green-600 font-bold">
                ✓ Đã Thanh Toán
            </Button>
        )}
      </div>
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: "order.details.before", 
});

export default OrderPaymentWidget;