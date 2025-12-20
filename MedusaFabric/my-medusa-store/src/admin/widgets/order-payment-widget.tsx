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
             setErrorMsg("ERROR 401: Unauthorized access to Fabric service.");
        } else {
             setErrorMsg(`ERROR ${res.status}: ${res.statusText}`);
        }
      }
    } catch (e) {
      console.error(e);
      setErrorMsg("Connection error");
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
        toast.success("Success", { description: "Payment completed" });
        await checkFabricStatus();
      } else {
        toast.error("Error", { description: result.error || "Failed." });
      }
    } catch (err) {
      toast.error("Connection error");
    } finally {
      setIsLoading(false);
    }
  };

  // FIX: Nếu không có data và không có lỗi thì ẩn
  if (!fabricStatus && !errorMsg) return null;

  return (
    <Container className="divide-y p-0 border border-white-200 shadow-sm mb-4">
      <div className="px-6 py-4 flex items-center justify-between bg-white-50">
        <div>
          <Heading level="h2" className="text-black-600">Blockchain Status</Heading>
          
          {/* FIX: Hiển thị errorMsg bằng component Text (đã khai báo) */}
          {errorMsg ? (
            <Text className="text-red-500 text-xs font-mono mt-1">{errorMsg}</Text>
          ) : (
            <div className="flex gap-2 mt-1">
                <Badge
                  className={
                    fabricStatus.status === "PAID"
                      ? "bg-black text-white"
                      : "bg-white text-black border"
                  }
                >
                  {fabricStatus.status}
                </Badge>
                <Badge>{fabricStatus.paymentMethod}</Badge>
            </div>
          )}
        </div>

        {fabricStatus && fabricStatus.paymentMethod === "PREPAID" && fabricStatus.status === "CREATED" && (
             <Button variant="secondary" onClick={handleConfirmPayment} isLoading={isLoading}>
                Confirm payment
            </Button>
        )}

        {fabricStatus && fabricStatus.status === "PAID" && (
             <Button disabled variant="transparent" className="text-green-600 font-bold">
                ✓ Payment completed
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