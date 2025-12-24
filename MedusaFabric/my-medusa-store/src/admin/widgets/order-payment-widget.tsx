// my-medusa-store/src/admin/widgets/order-payment-widget.tsx

import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Button, Container, Heading, Text, toast, Badge, Table } from "@medusajs/ui";
import { DetailWidgetProps, AdminOrder } from "@medusajs/framework/types";
import { useState, useEffect } from "react";

// Helper styles màu sắc
const getStatusColor = (status: string) => {
    switch (status) {
        case 'CREATED': return 'white';
        case 'PAID': return 'black';
        default: return 'grey';
    }
};

const OrderPaymentWidget = ({ data }: DetailWidgetProps<AdminOrder>) => {
  const [isLoading, setIsLoading] = useState<string | null>(null); // Lưu ID đang loading
  const [fabricData, setFabricData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const API_BASE = "/admin/fabric/orders"; 

  const checkFabricStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/${data.id}/status`, {
        method: "GET", credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        setFabricData(json); // json sẽ có dạng { isSplit: true, orders: [...] }
        setErrorMsg("");
      } else {
        if (res.status === 404) setFabricData(null); 
        else setErrorMsg(`Sync Error: ${res.statusText}`);
      }
    } catch (e) { setErrorMsg("Connection error"); }
  };

  useEffect(() => { checkFabricStatus(); }, [data.id]);

  // Hàm confirm cho từng đơn con
  const handleConfirmPayment = async (blockchainId: string) => {
    setIsLoading(blockchainId);
    try {
      // Gọi API confirm với ID cụ thể của đơn con (VD: order_123_2)
      const res = await fetch(`${API_BASE}/${blockchainId}/confirm-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      const result = await res.json();

      if (res.ok) {
        toast.success(`Payment confirmed for ${blockchainId}`);
        await checkFabricStatus();
      } else {
        toast.error("Error", { description: result.error || "Failed." });
      }
    } catch (err) { toast.error("Connection error"); } 
    finally { setIsLoading(null); }
  };

  if (!fabricData && !errorMsg) return null;

  return (
    <Container className="p-0 border border-ui-border-base shadow-sm mb-4 overflow-hidden">
      <div className="px-6 py-4 border-b border-ui-border-base bg-ui-bg-subtle flex justify-between items-center">
         <Heading level="h2">Blockchain Status</Heading>
         {errorMsg && <Badge color="red">{errorMsg}</Badge>}
            </div>

      <div className="p-0">
        {fabricData?.orders && fabricData.orders.length > 0 ? (
             <Table>
                <Table.Header>
                    <Table.Row>
                        <Table.HeaderCell>Sub-Order ID</Table.HeaderCell>
                        <Table.HeaderCell>Status</Table.HeaderCell>
                        <Table.HeaderCell>Payment</Table.HeaderCell>
                        <Table.HeaderCell className="text-right">Action</Table.HeaderCell>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {fabricData.orders.map((order: any) => (
                        <Table.Row key={order.id}>
                            <Table.Cell className="font-mono text-xs">{order.id}</Table.Cell>
                            <Table.Cell>
                                <Badge color={getStatusColor(order.status) as any}>{order.status}</Badge>
                            </Table.Cell>
                            <Table.Cell>
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs font-medium">{order.paymentMethod}</span>
                                    {order.paymentMethod === 'COD' && (
                                        <span className="text-[10px] text-ui-fg-muted">{order.codStatus}</span>
          )}
        </div>
                            </Table.Cell>
                            <Table.Cell className="text-right">
                                {order.paymentMethod === "PREPAID" && order.status === "CREATED" && (
                                    <Button 
                                        variant="secondary" 
                                        size="small" 
                                        onClick={() => handleConfirmPayment(order.id)} 
                                        isLoading={isLoading === order.id}
                                    >
                                        Confirm
            </Button>
        )}
                                {order.status === "PAID" && <span className="text-green-600 text-xs font-bold">✓ Paid</span>}
                                {order.status === "CANCELLED" && <span className="text-red-500 text-xs italic">Cancelled</span>}
                            </Table.Cell>
                        </Table.Row>
                    ))}
                </Table.Body>
             </Table>
        ) : (
            <div className="p-6 text-center text-ui-fg-subtle text-sm">
                No blockchain records found.
            </div>
        )}
      </div>
    </Container>
  );
};

export const config = defineWidgetConfig({ zone: "order.details.before" });
export default OrderPaymentWidget;