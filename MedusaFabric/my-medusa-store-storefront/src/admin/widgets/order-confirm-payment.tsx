// src\admin\widgets\order-confirm-payment.tsx

import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Button, Container, Text, Toaster, toast } from "@medusajs/ui";
// @ts-ignore - Bỏ qua lỗi check type nếu thư viện chưa load kịp type
import { useAdminOrder, useAdminUser } from "medusa-react";
import { useState, useEffect } from "react";

// Định nghĩa Interface cho props của Widget
interface OrderWidgetProps {
  data: {
    id: string;
  };
}

const OrderConfirmPaymentWidget = ({ data }: OrderWidgetProps) => {
  // @ts-ignore
  const { order } = useAdminOrder(data.id);
  // @ts-ignore
  const { user, isLoading } = useAdminUser();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [canAccess, setCanAccess] = useState(false);

  useEffect(() => {
    if (user) {
        // Fix lỗi: Ép kiểu user.metadata về object hoặc any để truy cập property
        const metadata = user.metadata as any;
        const role = metadata?.fabric_role || "";
        const email = user.email || "";
        
        const isSuperAdmin = email.includes('admin') || email.includes('thuquynh');
        const isOrg = role.toLowerCase() === 'ecommerceplatformorgmsp';

        if (isSuperAdmin || isOrg) {
            setCanAccess(true);
        } else {
            setCanAccess(false);
        }
    }
  }, [user]);

  const handleConfirmPayment = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch(`/admin/fabric/orders/${order.id}/confirm-payment`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        }
      });

      const result = await res.json();

      if (res.ok) {
        toast.success("Thành công", { description: `TxID: ${result.tx_id}` });
        window.location.reload();
      } else {
        toast.error("Lỗi", { description: result.error });
      }
    } catch (err) {
      toast.error("Lỗi kết nối hệ thống");
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading || !order) return null;

  if (!canAccess) {
      return null; 
  }

  // FIX LỖI 3 & 4: Thêm type 'any' cho pc và ps
  const isPrepaid = order.payment_collections?.some((pc: any) => 
    pc.payment_sessions?.some((ps: any) => 
        ps.provider_id === 'manual' || ps.provider_id === 'pp_system_default'
    )
  );

  return (
    <Container className="mb-4 bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-grey-90 text-base font-semibold">Blockchain Payment</h1>
          <Text className="text-grey-50">Xác nhận đã nhận tiền (Dành cho Admin)</Text>
        </div>
        
        <Button 
            variant="primary" 
            onClick={handleConfirmPayment}
            isLoading={isProcessing}
            disabled={!isPrepaid || order.status === 'completed'} 
        >
            Confirm Payment On-Chain
        </Button>
      </div>
      <Toaster />
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: "order.details.before",
});

export default OrderConfirmPaymentWidget;