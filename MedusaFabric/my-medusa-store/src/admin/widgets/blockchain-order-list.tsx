// src/admin/widgets/blockchain-order-list.tsx

import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { useEffect, useState, useMemo, useRef, useLayoutEffect } from "react";
import React from "react";
import {
    Heading, StatusBadge, Badge, Text, Drawer,
    Button, toast, Container, Toaster
} from "@medusajs/ui";
import {
    Spinner, Photo, Envelope, CurrencyDollar,
    MagnifyingGlass, Funnel, Plus, Minus, Clock, ComputerDesktop
} from "@medusajs/icons";

// --- 1. Error Boundary ---
const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
    const [hasError, setHasError] = useState(false);
    if (hasError) return <div className="p-4 text-red-500">Widget Error</div>;
    try { return <>{children}</>; } catch (e) { setHasError(true); return null; }
};

// --- 2. Helper Styles ---
const getStatusStyle = (status: string) => {
    const s = (status || "").toUpperCase();
    switch (s) {
        case 'CREATED': return { bg: '#F3F4F6', color: '#4B5563', border: '#E5E7EB' };
        case 'PAID': return { bg: '#DBEAFE', color: '#1E40AF', border: '#93C5FD' };
        case 'SHIPPED': case 'RETURN_IN_TRANSIT': return { bg: '#F3E8FF', color: '#7E22CE', border: '#D8B4FE' };
        case 'DELIVERED': case 'SETTLED': case 'COD_REMITTED': case 'RETURNED': return { bg: '#DCFCE7', color: '#15803D', border: '#86EFAC' };
        case 'DELIVERED_COD_PENDING': case 'PENDING_REMITTANCE': return { bg: '#FFEDD5', color: '#C2410C', border: '#FDBA74' };
        case 'CANCELLED': case 'RETURN_REQUESTED': return { bg: '#FEE2E2', color: '#B91C1C', border: '#FCA5A5' };
        default: return { bg: '#F9FAFB', color: '#6B7280', border: '#E5E7EB' };
    }
};

// --- 3. Icons Custom ---
const Icons = {
    Sort: () => (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3.125 6.875H10.625" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3.125 13.125H7.5" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M13.75 14.375L16.875 11.25" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M16.875 14.375L13.75 11.25" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M15.3125 5.625V14.375" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    Check: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
    )
};

// --- 4. Audit Trail Component (NEW) ---
const AuditTrail = ({ history, sellerId, shipperId }: { history: any[], sellerId: string, shipperId: string }) => {
    // Debug Log: Kiểm tra xem dữ liệu có vào đến đây không
    // console.log("AuditTrail Received:", history);

    if (!history || !Array.isArray(history) || history.length === 0) {
        return <Text className="text-ui-fg-subtle italic text-xs">No history recorded.</Text>;
    }

    // Sort history: Newest first
    const sortedHistory = [...history].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Hàm map tên hiển thị thân thiện
    const getActorName = (org: string) => {
        if (org === 'SellerOrgMSP') return sellerId || "Seller";
        if (org === 'ShipperOrgMSP') return shipperId || "Shipper";
        if (org === 'ECommercePlatformOrgMSP') return "Platform Admin";
        return org;
    };

    // Hàm format Action (Ví dụ: CreateOrder -> Create order)
    const formatAction = (action: string) => {
        if (!action) return "Unknown";
        // Tách chữ hoa: CreateOrder -> Create Order
        const spaced = action.replace(/([A-Z])/g, ' $1').trim();
        // Viết hoa chữ cái đầu, còn lại thường
        return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
    };

    return (
        <div className="flex flex-col gap-0 relative ml-2">
            <div className="absolute left-[15px] top-4 bottom-4 w-px bg-ui-border-base -z-10"></div>

            {sortedHistory.map((entry, index) => (
                <div key={index} className="flex gap-4 pb-6 last:pb-0 relative group">
                    <div className="h-8 w-8 rounded-full bg-ui-bg-base border border-ui-border-base flex items-center justify-center shrink-0 z-10 group-hover:border-ui-fg-interactive transition-colors">
                        <Clock className="w-4 h-4 text-ui-fg-subtle group-hover:text-ui-fg-interactive" />
                    </div>

                    <div className="flex flex-col flex-1 pt-1">
                        <div className="flex justify-between items-start">
                            <div className="flex flex-col">
                                {/* Format Action thành chữ thường đẹp mắt */}
                                <span className="text-sm font-medium text-ui-fg-base">
                                    {formatAction(entry.action)}
                                </span>
                                <div className="flex items-center gap-2 mt-0.5">
                                    {/* Hiển thị Company ID thay vì MSP */}
                                    <span className="text-[10px] bg-ui-bg-subtle px-1.5 py-0.5 rounded text-ui-fg-muted border border-ui-border-base font-mono font-medium">
                                        {getActorName(entry.actorOrg)}
                                    </span>
                                    <span className="text-xs text-ui-fg-subtle">
                                        {new Date(entry.timestamp).toLocaleString('en-GB')}
                                    </span>
                                </div>
                            </div>
                        </div>
                        {entry.txID && (
                            <div className="mt-1.5 p-1.5 bg-ui-bg-subtle/50 rounded border border-ui-border-transparent hover:border-ui-border-base transition-colors w-fit">
                                <div className="flex items-center gap-1.5">
                                    <ComputerDesktop className="w-3 h-3 text-ui-fg-muted" />
                                    {/* TxID hiển thị ngắn gọn */}
                                    <Text size="xsmall" className="font-mono text-ui-fg-muted truncate max-w-[200px]" title={entry.txID}>
                                        Tx: {entry.txID.substring(0, 15)}...
                                    </Text>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};


// --- 5. Order Drawer ---
const OrderDrawer = ({ blockchainOrder, onClose, onRefresh }: { blockchainOrder: any, onClose: () => void, onRefresh: () => void }) => {
    const [medusaOrder, setMedusaOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isRemitting, setIsRemitting] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);

    const [showAllItems, setShowAllItems] = useState(false);

    const originalId = blockchainOrder.blockchain_id.replace(/_\d+$/, '');

    useEffect(() => {
        const fetchMedusaOrder = async () => {
            try {
                const res = await fetch(`/admin/orders/${originalId}`, { credentials: "include" });
                const data = await res.json();
                setMedusaOrder(data.order);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchMedusaOrder();
    }, [originalId, blockchainOrder]);

    const handleConfirmPayment = async () => {
        if (!confirm("Confirm payment received for this sub-order?")) return;

        setIsConfirmingPayment(true);
        try {
            // Gọi đúng API confirm-payment cho sub-order ID
            const res = await fetch(`/admin/fabric/orders/${blockchainOrder.blockchain_id}/confirm-payment`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
            });

            const result = await res.json();

            if (res.ok) {
                toast.success("Payment confirmed successfully!");
                onRefresh(); // Refresh list để cập nhật status thành PAID
                onClose();   // Đóng drawer
            } else {
                toast.error("ERROR: " + (result.error || "Failed to confirm payment."));
            }
        } catch (e) {
            console.error(e);
            toast.error("Network error.");
        } finally {
            setIsConfirmingPayment(false);
        }
    };

    const handleRemitCOD = async () => {
        if (!confirm("Confirm received COD?")) return;
        setIsRemitting(true);
        try {
            const res = await fetch(`/admin/fabric/orders/${blockchainOrder.blockchain_id}/remit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });

            const result = await res.json();

            if (res.ok) {
                toast.success("Payment received successfully!");
                onRefresh();
                onClose();
            } else {
                toast.error("ERROR: " + (result.message || "FAILED to remit COD payment."));
            }
        } catch (e) {
            console.error(e);
            toast.error("Network error during remittance.");
        } finally {
            setIsRemitting(false);
        }
    };

    const handleCancelOrder = async () => {
        if (!confirm(`Confirm cancel order ${blockchainOrder.blockchain_id}?\n\nNote: Orders can only be cancelled when in CREATED or PAID status.`)) {
            return;
        }

        setIsCancelling(true);
        try {
            const res = await fetch(`/admin/fabric/orders/${blockchainOrder.blockchain_id}/cancel`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
            });

            const result = await res.json();

            if (res.ok) {
                toast.success("Order cancelled successfully!");
                onRefresh();
                onClose();
            } else {
                toast.error("ERROR: " + (result.error || "Failed to cancel order."));
            }
        } catch (e) {
            console.error(e);
            toast.error("Network error during order cancellation.");
        } finally {
            setIsCancelling(false);
        }
    };

    const subOrderItems = useMemo(() => {
        if (!medusaOrder || !medusaOrder.items) return [];
        return medusaOrder.items.filter((item: any) => {
            const itemSellerId = item.variant?.product?.metadata?.seller_company_id;
            return itemSellerId === blockchainOrder.seller_id;
        });
    }, [medusaOrder, blockchainOrder.seller_id]);

    const subTotalItems = subOrderItems.reduce((sum: number, item: any) => sum + (item.unit_price * item.quantity), 0);
    const originalShippingFee = medusaOrder?.shipping_total || 0;
    const currencyCode = medusaOrder?.currency_code?.toUpperCase() || "USD";

    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(amount).replace('EUR', '€');
    };

    const DISPLAY_LIMIT = 1;
    const visibleItems = showAllItems ? subOrderItems : subOrderItems.slice(0, DISPLAY_LIMIT);
    const hiddenCount = Math.max(0, subOrderItems.length - DISPLAY_LIMIT);

    // --- Logic lấy History an toàn ---
    const getHistoryData = () => {
        if (blockchainOrder.history && Array.isArray(blockchainOrder.history)) return blockchainOrder.history;
        if (blockchainOrder.Record && Array.isArray(blockchainOrder.Record.history)) return blockchainOrder.Record.history;
        if (blockchainOrder.decryptedData && Array.isArray(blockchainOrder.decryptedData.history)) return blockchainOrder.decryptedData.history;
        return [];
    };

    const historyData = getHistoryData();

    return (
        <Drawer open={true} onOpenChange={(open) => !open && onClose()}>
            {/* Fix Layout: flex-col + h-full để chiếm toàn màn hình Drawer */}
            <Drawer.Content className="flex flex-col h-full max-h-screen outline-none">
                <Drawer.Header>
                    <Drawer.Title>Split Order Details</Drawer.Title>
                    {/* Fix Warning: Description ẩn */}
                    <Drawer.Description className="hidden">Details of order fetched from Blockchain</Drawer.Description>
                </Drawer.Header>

                {/* Fix Scroll: flex-1 + overflow-y-auto để chỉ cuộn phần nội dung */}
                <Drawer.Body className="p-0 flex-1 overflow-y-auto relative">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <Spinner className="animate-spin text-ui-fg-interactive" />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-y-6 p-6">
                            {/* Header Info */}
                            <div className="bg-ui-bg-subtle p-4 rounded-lg border border-ui-border-base flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                    <Text size="small" className="text-ui-fg-subtle">Blockchain ID</Text>
                                    <Text size="small" className="font-mono text">{blockchainOrder.blockchain_id}</Text>
                                </div>

                                <div className="flex justify-between items-start pt-2 border-t border-ui-border-base">
                                    <Text size="small" className="text-ui-fg-subtle">Shop (Seller)</Text>
                                    <div className="flex flex-col items-end">
                                        <Text size="small" className="font-medium">{blockchainOrder.seller_id}</Text>
                                        <div className="flex items-center gap-1 text-[10px] text-ui-fg-muted">
                                            <Envelope className="w-3 h-3" />
                                            {blockchainOrder.seller_email || "No Email"}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-between items-start pt-2 border-t border-ui-border-base">
                                    <Text size="small" className="text-ui-fg-subtle">Shipper</Text>
                                    <div className="flex flex-col items-end">
                                        <div className="flex items-center gap-1">
                                            <span className="h-2 w-2 rounded-full"></span>
                                            <Text size="small" className="font-medium">{blockchainOrder.shipper_id || "Unknown"}</Text>
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] text-ui-fg-muted">
                                            <Envelope className="w-3 h-3" />
                                            {blockchainOrder.shipper_email || "No Email"}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center pt-2 border-t border-ui-border-base">
                                    <Text size="small" className="text-ui-fg-subtle">Status</Text>
                                    <StatusBadge color={getStatusStyle(blockchainOrder.status).color as any}>
                                        {blockchainOrder.status}
                                    </StatusBadge>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-ui-border-base">
                                    <Text size="small" className="text-ui-fg-subtle">Created date</Text>
                                    <Text size="small" className="font-mono font-medium">
                                        {blockchainOrder.created_at ? new Date(blockchainOrder.created_at).toLocaleString('en-GB') : "-"}
                                    </Text>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-ui-border-base">
                                    <Text size="small" className="text-ui-fg-subtle">Payment</Text>
                                    <div className="flex gap-1">
                                        <Badge size="small" color={blockchainOrder.payment_method === 'COD' ? 'orange' : 'blue'}>
                                            {blockchainOrder.payment_method}
                                        </Badge>
                                        {blockchainOrder.cod_status && (
                                            <Badge size="small" color={blockchainOrder.cod_status === 'REMITTED' ? 'green' : 'grey'}>
                                                {blockchainOrder.cod_status}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Items List - With Scroll & Show More */}
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <Heading level="h3">Items in Package</Heading>
                                    <Text size="small" className="text-ui-fg-muted">{subOrderItems.length} items</Text>
                                </div>

                                <div className="flex flex-col gap-y-4">
                                    {visibleItems.length > 0 ? visibleItems.map((item: any) => (
                                        <div key={item.id} className="flex gap-x-4 items-start border-b border-ui-border-base pb-4 last:border-0 last:pb-0">
                                            <div className="h-10 w-10 rounded-md overflow-hidden bg-ui-bg-subtle border border-ui-border-base flex items-center justify-center shrink-0">
                                                {item.thumbnail ? <img src={item.thumbnail} alt={item.title} className="h-full w-full object-cover" /> : <Photo className="text-ui-fg-subtle" />}
                                            </div>

                                            <div className="flex-1">
                                                <div className="flex justify-between">
                                                    <Text className="text-ui-fg-base font-medium text-sm line-clamp-1">{item.title}</Text>
                                                    <Text className="text-ui-fg-base text-sm">{formatMoney(item.unit_price * item.quantity)}</Text>
                                                </div>
                                                <Text size="small" className="text-ui-fg-subtle">{item.variant?.title}</Text>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Text size="small" className="text-ui-fg-subtle">Qty: {item.quantity}</Text>
                                                    <Text size="small" className="text-ui-fg-subtle">x {formatMoney(item.unit_price)}</Text>
                                                </div>
                                            </div>
                                        </div>
                                    )) : (
                                        <Text className="text-ui-fg-subtle italic">No items found.</Text>
                                    )}
                                </div>

                                {/* Show More / Show Less Button */}
                                {subOrderItems.length > DISPLAY_LIMIT && (
                                    <button
                                        onClick={() => setShowAllItems(!showAllItems)}
                                        className="mt-3 text-xs text-ui-fg-interactive hover:text-ui-fg-interactive-hover flex items-center justify-center gap-1 font-medium w-full py-2 bg-ui-bg-subtle rounded-md border border-transparent hover:border-ui-border-base transition-all"
                                    >
                                        {showAllItems ? (
                                            <><Minus className="w-3 h-3" /> Show Less</>
                                        ) : (
                                            <><Plus className="w-3 h-3" /> Show {hiddenCount} more items</>
                                        )}
                                    </button>
                                )}
                            </div>

                            {/* Totals Section */}
                            <div className="border-t border-ui-border-base pt-4 space-y-2 pb-4">
                                <div className="flex justify-between items-center">
                                    <Text className="text-ui-fg-subtle">Subtotal (This Seller)</Text>
                                    <Text className="font-medium">{formatMoney(subTotalItems)}</Text>
                                </div>
                                <div className="flex justify-between items-center">
                                    <Text className="text-ui-fg-subtle">Shipping (Original)</Text>
                                    <Text className="font-medium">{formatMoney(originalShippingFee)}</Text>
                                </div>
                            </div>

                            <div className="border-t-2 border-ui-border-base pt-6 pb-4"><div className="flex items-center justify-between mb-6"><div className="flex items-center gap-2"><Heading level="h3">Audit Trail</Heading><Badge size="small" color="grey">Immutable</Badge></div></div><AuditTrail history={historyData} sellerId={blockchainOrder.seller_id} shipperId={blockchainOrder.shipper_id} /></div>

                        </div>
                    )}
                </Drawer.Body>

                <Drawer.Footer className="flex justify-between items-center border-t border-ui-border-base pt-4 bg-ui-bg-base z-10 shrink-0">
                    <div className="flex gap-2">
                        <Drawer.Close asChild>
                            <Button variant="secondary">Close</Button>
                        </Drawer.Close>
                        <Button onClick={() => window.open(`/app/orders/${originalId}`, '_blank')}>
                            Original Order
                        </Button>
                    </div>

                    <div className="flex gap-2">
                        {blockchainOrder.payment_method === 'PREPAID' && blockchainOrder.status === 'CREATED' && (
                            <Button
                                variant="primary"
                                onClick={handleConfirmPayment}
                                isLoading={isConfirmingPayment}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200"
                            >
                                <CurrencyDollar /> Confirm Payment
                            </Button>
                        )}

                        {/* Cancel Order */}
                        {(blockchainOrder.status === 'CREATED' || blockchainOrder.status === 'PAID') && (
                            <Button variant="danger" onClick={handleCancelOrder} isLoading={isCancelling}>
                                Cancel Order
                            </Button>
                        )}

                        {/* Nút Remit COD - chỉ hiện khi COD PENDING_REMITTANCE */}
                        {blockchainOrder.payment_method === 'COD' && blockchainOrder.cod_status === 'PENDING_REMITTANCE' && (
                            <Button
                                variant="primary"
                                onClick={handleRemitCOD}
                                isLoading={isRemitting}
                                className="bg-green-600 hover:bg-green-700 text-white"
                            >
                                <CurrencyDollar /> Confirm COD Payment
                            </Button>
                        )}
                    </div>
                </Drawer.Footer>
            </Drawer.Content>
        </Drawer>
    );
};

// --- MAIN WIDGET COMPONENT ---
type SortKey = 'blockchain_id' | 'created_at';
type SortDirection = 'asc' | 'desc';

const BlockchainOrderList = () => {
    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState("");
    const [selectedOrder, setSelectedOrder] = useState<any>(null);

    const widgetRef = useRef<HTMLDivElement>(null);

    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [paymentFilter, setPaymentFilter] = useState("ALL");
    const [codStatusFilter, setCodStatusFilter] = useState("ALL");
    const [currentPage, setCurrentPage] = useState(1);

    const [sortKey, setSortKey] = useState<SortKey>('created_at');
    const [sortDir, setSortDir] = useState<SortDirection>('desc');
    const [showSortMenu, setShowSortMenu] = useState(false);

    const sortMenuRef = useRef<HTMLDivElement>(null);
    const ITEMS_PER_PAGE = 10;

    useLayoutEffect(() => {
        const hideDefaultInterface = () => {
            const widgetEl = widgetRef.current;
            if (!widgetEl) return;

            // Đi tìm phần tử cha "Main"
            let container = widgetEl.parentElement;
            let mainContainer = null;

            // Traverse up to find the main layout container
            while (container) {
                if (container.tagName === 'MAIN' || container.getAttribute('role') === 'main' || container.classList.contains('medusa-admin-layout')) {
                    mainContainer = container;
                    break;
                }
                container = container.parentElement;
            }

            if (mainContainer) {
                // Lặp qua tất cả con của Main
                Array.from(mainContainer.children).forEach((child: any) => {
                    // Nếu child KHÔNG PHẢI là container chứa Widget -> Ẩn
                    if (!child.contains(widgetEl)) {
                        child.style.display = 'none';
                        child.style.visibility = 'hidden';
                        child.setAttribute('data-hidden-by-custom-widget', 'true');
                    }
                });
            }
        };

        // 1. Chạy ngay
        hideDefaultInterface();

        // 2. Chạy liên tục trong 1 giây đầu (phòng trường hợp React re-render)
        const interval = setInterval(hideDefaultInterface, 50);
        const timeout = setTimeout(() => clearInterval(interval), 1000);

        // 3. Dùng Observer để canh chừng thay đổi DOM vĩnh viễn
        const observer = new MutationObserver(() => {
            hideDefaultInterface();
        });

        // Observe body hoặc root để bắt mọi thay đổi
        const rootEl = document.getElementById('root') || document.body;
        observer.observe(rootEl, { childList: true, subtree: true });

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
            observer.disconnect();
        }
    }, []);

    // Click outside sort menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
                setShowSortMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Fetch Data
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/admin/fabric/orders/list`, {
                method: "GET", credentials: "include"
            });
            if (res.ok) {
                const data = await res.json();
                const mappedOrders = (data.orders || []).map((o: any) => ({
                    ...o,
                    updated_at: o.updatedAt || o.updated_at || o.created_at
                }));
                setOrders(mappedOrders);
            } else {
                setErrorMsg("Lỗi tải dữ liệu Blockchain");
            }
        } catch (e) { setErrorMsg("Lỗi kết nối"); }
        finally { setIsLoading(false); }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const processedOrders = useMemo(() => {
        let filtered = orders.filter(o => {
            const status = o.status || "";
            const payment = o.payment_method || "";
            const codStatus = o.cod_status || "";
            const searchLower = searchQuery.toLowerCase();
            const matchSearch = (o.blockchain_id || "").toLowerCase().includes(searchLower) || (o.seller_id || "").toLowerCase().includes(searchLower);
            const matchStatus = statusFilter === "ALL" || status === statusFilter;
            const matchPayment = paymentFilter === "ALL" || payment === paymentFilter;
            const matchCodStatus = paymentFilter !== "COD" || codStatusFilter === "ALL" || codStatus === codStatusFilter;
            return matchSearch && matchStatus && matchPayment && matchCodStatus;
        });

        return filtered.sort((a, b) => {
            let aVal: any = 0;
            let bVal: any = 0;

            if (sortKey === 'blockchain_id') {
                aVal = a.blockchain_id; bVal = b.blockchain_id;
            } else {
                // created_at
                aVal = new Date(a.created_at).getTime();
                bVal = new Date(b.created_at).getTime();
            }

            if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
    }, [orders, searchQuery, statusFilter, paymentFilter, codStatusFilter, sortKey, sortDir]);

    const totalPages = Math.ceil(processedOrders.length / ITEMS_PER_PAGE);
    const paginatedOrders = processedOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : "-";

    return (
        <ErrorBoundary>
            <Toaster />

            {/* CSS Ẩn Header mặc định (Backup) */}
            <style>{`
            h1.inter-xlarge-semibold.text-grey-90 { display: none !important; }
            .medusa-widget-zone + div { display: none !important; }
        `}</style>

            {/* Gắn ref vào đây để JS tìm cha của nó */}
            <div ref={widgetRef} className="w-full h-full">
                <Container className="p-0 overflow-hidden min-h-[600px] border-0 shadow-none">
                    {/* Header Custom */}
                    <div className="p-6 border-b border-ui-border-base flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-ui-bg-base">
                        <div>
                            <h1 className="text-2xl font-semibold text-ui-fg-base m-0">Blockchain Ledger</h1>
                            <p className="text-sm text-ui-fg-subtle mt-1">Live tracking of split orders from Hyperledger Fabric</p>
                        </div>
                        <Button onClick={fetchData} variant="secondary">Refresh</Button>
                    </div>

                    {/* Toolbar */}
                    <div className="px-6 py-3 border-b border-ui-border-base flex gap-4 items-center bg-ui-bg-subtle/30">
                        <div className="relative">
                            <span className="absolute left-2.5 top-2.5 text-ui-fg-muted"><MagnifyingGlass /></span>
                            <input placeholder="Search ID / Seller..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-3 py-1.5 text-sm border border-ui-border-base rounded-md focus:outline-none focus:border-ui-fg-interactive w-64" />
                        </div>
                        <div className="flex items-center gap-2">
                            <Funnel className="text-ui-fg-muted" />
                            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm bg-transparent border border-ui-border-base rounded-md px-2 py-1.5 cursor-pointer">
                                <option value="ALL">All Status</option>
                                <option value="CREATED">Created</option>
                                <option value="PAID">Paid</option>
                                <option value="SHIPPED">Shipped</option>
                                <option value="DELIVERED">Delivered</option>
                                <option value="SETTLED">Settled</option>
                                <option value="RETURNED">Returned</option>
                            </select>
                            <select value={paymentFilter} onChange={e => { setPaymentFilter(e.target.value); setCodStatusFilter("ALL"); }} className="text-sm bg-transparent border border-ui-border-base rounded-md px-2 py-1.5 cursor-pointer">
                                <option value="ALL">All Payment</option>
                                <option value="COD">COD</option>
                                <option value="PREPAID">PREPAID</option>
                            </select>
                            {paymentFilter === "COD" && (
                                <select value={codStatusFilter} onChange={e => setCodStatusFilter(e.target.value)} className="text-sm bg-transparent border border-ui-border-base rounded-md px-2 py-1.5 cursor-pointer">
                                    <option value="ALL">All COD Status</option>
                                    <option value="PENDING_REMITTANCE">Pending Remittance</option>
                                    <option value="REMITTED">Remitted</option>
                                </select>
                            )}
                        </div>
                        <div className="flex-1"></div>
                        <div className="relative" ref={sortMenuRef}>
                            <button onClick={() => setShowSortMenu(!showSortMenu)} className="flex items-center gap-2 px-3 py-1.5 border border-ui-border-base rounded-md bg-ui-bg-base hover:bg-ui-bg-subtle cursor-pointer text-sm">
                                <Icons.Sort /> Sort
                            </button>
                            {showSortMenu && (
                                <div className="absolute top-full right-0 mt-2 w-48 bg-ui-bg-base border border-ui-border-base rounded-md shadow-lg z-50 py-1">
                                    <div className="px-3 py-2 text-xs font-semibold text-ui-fg-muted bg-ui-bg-subtle border-b border-ui-border-base">Sort By</div>
                                    <div onClick={() => { setSortKey('created_at'); setShowSortMenu(false); }} className={`px-4 py-2 text-sm cursor-pointer hover:bg-ui-bg-subtle flex justify-between ${sortKey === 'created_at' ? 'font-bold' : ''}`}>
                                        Created Date {sortKey === 'created_at' && <Icons.Check />}
                                    </div>
                                    <div className="h-px bg-ui-border-base my-1"></div>
                                    <div onClick={() => { setSortDir('desc'); setShowSortMenu(false); }} className={`px-4 py-2 text-sm cursor-pointer hover:bg-ui-bg-subtle flex justify-between ${sortDir === 'desc' ? 'font-bold' : ''}`}>Newest First {sortDir === 'desc' && <Icons.Check />}</div>
                                    <div onClick={() => { setSortDir('asc'); setShowSortMenu(false); }} className={`px-4 py-2 text-sm cursor-pointer hover:bg-ui-bg-subtle flex justify-between ${sortDir === 'asc' ? 'font-bold' : ''}`}>Oldest First {sortDir === 'asc' && <Icons.Check />}</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-sm">
                            <thead className="bg-ui-bg-subtle border-b border-ui-border-base">
                                <tr>
                                    {['Blockchain ID', 'Created at', 'Seller', 'Status', 'Payment', 'Info'].map(h => <th key={h} className="px-6 py-3 text-xs font-medium text-ui-fg-muted uppercase">{h}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedOrders.map((o) => (
                                    <tr key={o.blockchain_id} className="border-b border-ui-border-base hover:bg-ui-bg-subtle/50 cursor-pointer" onClick={() => setSelectedOrder(o)}>
                                        <td className="px-6 py-4 font-mono font-medium">{o.blockchain_id}</td>
                                        <td className="px-6 py-4 text-ui-fg-subtle">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-ui-fg-base">{o.created_at ? new Date(o.created_at).toLocaleDateString('en-GB') : formatDate(o.created_at)}</span>
                                                <span className="text-[10px] text-ui-fg-muted">{o.created_at ? new Date(o.created_at).toLocaleTimeString('en-GB') : ''}</span>
                                            </div>
                                        </td>

                                        <td className="px-6 py-4">{o.seller_id}</td>
                                        <td className="px-6 py-4"><span className="px-2 py-1 rounded text-xs font-semibold border" style={getStatusStyle(o.status) as any}>{o.status}</span></td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col"><span className="text-xs font-mono">{o.payment_method}</span>{o.payment_method === 'COD' && <span className="text-[10px] text-gray-500">{o.cod_status}</span>}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right italic text-xs text-ui-fg-muted">View</td>
                                    </tr>
                                ))}
                                {!isLoading && paginatedOrders.length === 0 && <tr><td colSpan={6} className="px-6 py-12 text-center text-ui-fg-muted">No orders found.</td></tr>}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="px-6 py-4 border-t border-ui-border-base flex justify-between items-center bg-ui-bg-subtle/20">
                        <div className="text-xs text-ui-fg-muted">Showing {paginatedOrders.length} results</div>
                        <div className="flex gap-2">
                            <Button variant="secondary" size="small" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</Button>
                            <span className="text-xs flex items-center px-2">Page {currentPage}</span>
                            <Button variant="secondary" size="small" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>Next</Button>
                        </div>
                    </div>

                    {selectedOrder && <OrderDrawer blockchainOrder={selectedOrder} onClose={() => setSelectedOrder(null)} onRefresh={fetchData} />}
                </Container>
            </div>
        </ErrorBoundary>
    );
};

export const config = defineWidgetConfig({ zone: "order.list.before" });
export default BlockchainOrderList;