// my-medusa-store/src/admin/widgets/order-cancel-widget.tsx

import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Button, Container, Heading, toast } from "@medusajs/ui";
import { DetailWidgetProps, AdminOrder } from "@medusajs/framework/types";
import { useState, useEffect } from "react";

const OrderCancelWidget = ({ data }: DetailWidgetProps<AdminOrder>) => {
    const [isCancelling, setIsCancelling] = useState(false);
    const [subOrders, setSubOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const API_BASE = "/admin/fabric/orders";

    // Fetch sub-orders status from blockchain
    useEffect(() => {
        const fetchSubOrders = async () => {
            try {
                const res = await fetch(`${API_BASE}/${data.id}/status`, {
                    method: "GET",
                    credentials: "include",
                });

                if (res.ok) {
                    const json = await res.json();

                    // CASE 1: Split orders (status = "SPLIT_ORDER" and has sub_orders array)
                    if (json.status === "SPLIT_ORDER" && json.sub_orders) {
                        setSubOrders(json.sub_orders);
                    }
                    // CASE 2: Single order (has blockchain_id directly)
                    else if (json.blockchain_id) {
                        setSubOrders([{
                            blockchain_id: json.blockchain_id,
                            status: json.status,
                            paymentMethod: json.paymentMethod,
                            codStatus: json.codStatus,
                            updatedAt: json.updatedAt,
                        }]);
                    }
                    // CASE 3: Legacy format (no blockchain_id, use original id)
                    else if (json.status && json.status !== "NOT_SYNCED") {
                        setSubOrders([{
                            blockchain_id: data.id,
                            status: json.status,
                            paymentMethod: json.paymentMethod,
                            codStatus: json.codStatus,
                            updatedAt: json.updatedAt,
                        }]);
                    }
                }
            } catch (e) {
                console.error("Failed to fetch sub-orders:", e);
            } finally {
                setLoading(false);
            }
        };

        fetchSubOrders();
    }, [data.id]);

    const handleCancelOrder = async (blockchainId: string) => {
        if (!confirm(`Xác nhận HỦY đơn hàng ${blockchainId}?\n\nLưu ý: Đơn hàng chỉ có thể hủy khi ở trạng thái CREATED hoặc PAID. Kho hàng sẽ được hoàn lại nếu đơn đã ship.`)) {
            return;
        }

        setIsCancelling(true);
        try {
            const res = await fetch(`${API_BASE}/${blockchainId}/cancel`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
            });

            const result = await res.json();

            if (res.ok) {
                toast.success("Đơn hàng đã được hủy và hoàn kho thành công!");
                // Refresh page to update status
                window.location.reload();
            } else {
                toast.error("LỖI: " + (result.error || "Không thể hủy đơn hàng."));
            }
        } catch (e) {
            console.error(e);
            toast.error("Lỗi mạng khi hủy đơn hàng.");
        } finally {
            setIsCancelling(false);
        }
    };

    // Only show if there are cancellable orders
    const cancellableOrders = subOrders.filter(
        (order) => order.status === 'CREATED' || order.status === 'PAID'
    );

    if (loading || cancellableOrders.length === 0) {
        return null;
    }

    return (
        <Container className="divide-y p-0 border border-ui-border-base shadow-sm">
            <div className="px-6 py-4 bg-ui-bg-base">
                <Heading level="h2" className="mb-4">Order Actions</Heading>

                <div className="flex flex-col gap-3">
                    {cancellableOrders.map((order, index) => {
                        const blockchainId = order.blockchain_id;
                        console.log(`[OrderCancelWidget] Rendering cancel button for:`, blockchainId);

                        return (
                            <div key={blockchainId || index} className="flex items-center justify-between p-3 bg-ui-bg-subtle rounded border border-ui-border-base">
                                <div className="flex flex-col gap-1">
                                    <span className="font-medium text-sm">
                                        {cancellableOrders.length > 1 ? `Package #${index + 1}` : 'Order'} - {order.status}
                                    </span>
                                    <span className="text-xs text-ui-fg-subtle font-mono">
                                        {blockchainId}
                                    </span>
                                </div>

                                <Button
                                    variant="danger"
                                    onClick={() => {
                                        console.log(`[OrderCancelWidget] Cancel button clicked for: ${blockchainId}`);
                                        handleCancelOrder(blockchainId);
                                    }}
                                    isLoading={isCancelling}
                                    size="small"
                                >
                                    Cancel Order
                                </Button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </Container>
    );
};

export const config = defineWidgetConfig({
    zone: "order.details.after",
});

export default OrderCancelWidget;
