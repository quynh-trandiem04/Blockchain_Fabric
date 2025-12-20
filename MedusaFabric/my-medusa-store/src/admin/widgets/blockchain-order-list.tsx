// src/admin/widgets/blockchain-order-list.tsx

import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { useEffect, useState, useMemo, useRef } from "react";
import React from "react";
import { 
    Heading, StatusBadge, Badge, Text, Drawer, 
    Button, toast 
} from "@medusajs/ui";
import { Spinner, Photo, Envelope, CurrencyDollar } from "@medusajs/icons"; 

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

// --- 3. Icons ---
const Icons = {
  Sort: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.125 6.875H10.625" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3.125 13.125H7.5" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M13.75 14.375L16.875 11.25" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16.875 14.375L13.75 11.25" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M15.3125 5.625V14.375" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Check: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  )
};

// --- 4. Sub-Component: Order Drawer ---
const OrderDrawer = ({ blockchainOrder, onClose, onRefresh }: { blockchainOrder: any, onClose: () => void, onRefresh: () => void }) => {
    const [medusaOrder, setMedusaOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isRemitting, setIsRemitting] = useState(false); // State loading cho nút Remit

    const originalId = blockchainOrder.blockchain_id.replace(/_\d+$/, '');

    useEffect(() => {
        const fetchMedusaOrder = async () => {
            try {
                // Chỉ lấy chi tiết đơn hàng gốc từ DB
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
        
    }, [originalId]);

    // Hàm gọi API Remit
    const handleRemitCOD = async () => {
        if (!confirm("Xác nhận đã nhận đủ tiền COD từ đơn vị vận chuyển?")) return;
        
        setIsRemitting(true);
        try {
            // Gọi API Remit với ID blockchain
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
                toast.error("ERROR: " + (result.message || "FALIED to remit COD payment."));
            }
        } catch (e) {
            console.error(e);
            toast.error("Network error during remittance.");
        } finally {
            setIsRemitting(false);
        }
    };

    // Lọc sản phẩm theo Seller
    const subOrderItems = useMemo(() => {
        if (!medusaOrder || !medusaOrder.items) return [];
        return medusaOrder.items.filter((item: any) => {
            const itemSellerId = item.variant?.product?.metadata?.seller_company_id;
            return itemSellerId === blockchainOrder.seller_id;
        });
    }, [medusaOrder, blockchainOrder.seller_id]);

    // --- LOGIC TÍNH TOÁN ---
    
    // 1. Tiền hàng (Subtotal)
    const subTotalItems = subOrderItems.reduce((sum: number, item: any) => sum + (item.unit_price * item.quantity), 0);
    
    // 2. Phí ship gốc từ DB (Original Total Shipping)
    const originalShippingFee = medusaOrder?.shipping_total || 0;

    const currencyCode = medusaOrder?.currency_code?.toUpperCase() || "USD";

    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(amount).replace('EUR', '€');
    };

    return (
        <Drawer open={true} onOpenChange={(open) => !open && onClose()}>
            <Drawer.Content>
                <Drawer.Header>
                    <Drawer.Title>Split Order Details</Drawer.Title>
                </Drawer.Header>
                <Drawer.Body className="p-0">
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
                                
                                {/* SELLER INFO */}
                                <div className="flex justify-between items-start pt-2 border-t border-ui-border-base">
                                    <Text size="small" className="text-ui-fg-subtle">Shop (Seller)</Text>
                                    <div className="flex flex-col items-end">
                                    <Text size="small" className="font-medium">{blockchainOrder.seller_id}</Text>
                                        <div className="flex items-center gap-1 text-[10px] text-ui-fg-muted">
                                            <Envelope className="w-3 h-3"/> 
                                            {/* 🔥 HIỂN THỊ TRỰC TIẾP TỪ PROP 🔥 */}
                                            {blockchainOrder.seller_email || "No Email"}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* SHIPPER INFO */}
                                <div className="flex justify-between items-start pt-2 border-t border-ui-border-base">
                                    <Text size="small" className="text-ui-fg-subtle">Shipper (Carrier)</Text>
                                    <div className="flex flex-col items-end">
                                    <div className="flex items-center gap-1">
                                            <span className="h-2 w-2 rounded-full"></span>
                                            <Text size="small" className="font-medium">{blockchainOrder.shipper_id || "Unknown"}</Text>
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] text-ui-fg-muted">
                                            <Envelope className="w-3 h-3"/> 
                                            {/* 🔥 HIỂN THỊ TRỰC TIẾP TỪ PROP 🔥 */}
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
                                <div className="flex justify-between items-center">
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

                            {/* Items List */}
                            <div>
                                <Heading level="h3" className="mb-4">Items in this Package</Heading>
                                <div className="flex flex-col gap-y-4">
                                    {subOrderItems.length > 0 ? subOrderItems.map((item: any) => (
                                        <div key={item.id} className="flex gap-x-4 items-start border-b border-ui-border-base pb-4 last:border-0">
                                            <div className="h-10 w-10 rounded-md overflow-hidden bg-ui-bg-subtle border border-ui-border-base flex items-center justify-center shrink-0">
                                                {item.thumbnail ? (
                                                    <img src={item.thumbnail} alt={item.title} className="h-full w-full object-cover" />
                                                ) : (
                                                    <Photo className="text-ui-fg-subtle" />
                                                )}
                                            </div>
                                            
                                            <div className="flex-1">
                                                <div className="flex justify-between">
                                                    <Text className="text-ui-fg-base font-medium">{item.title}</Text>
                                                    <Text className="text-ui-fg-base">{formatMoney(item.unit_price * item.quantity)}</Text>
                                                </div>
                                                <Text size="small" className="text-ui-fg-subtle">{item.variant?.title}</Text>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Text size="small" className="text-ui-fg-subtle">Qty: {item.quantity}</Text>
                                                    <Text size="small" className="text-ui-fg-subtle">x {formatMoney(item.unit_price)}</Text>
                                                </div>
                                            </div>
                                        </div>
                                    )) : (
                                        <Text className="text-ui-fg-subtle italic">
                                            No items found matching this seller ID ({blockchainOrder.seller_id}). 
                                        </Text>
                                    )}
                                </div>
                            </div>

                            {/* Totals Section */}
                            <div className="border-t border-ui-border-base pt-4 space-y-2">
                                <div className="flex justify-between items-center">
                                    <Text className="text-ui-fg-subtle">Subtotal (This Seller)</Text>
                                    <Text className="font-medium">{formatMoney(subTotalItems)}</Text>
                                </div>
                                <div className="flex justify-between items-center">
                                    <Text className="text-ui-fg-subtle">Shipping Fee (Original Order)</Text>
                                    <Text className="font-medium">{formatMoney(originalShippingFee)}</Text>
                                </div>
                            </div>
                        </div>
                    )}
                </Drawer.Body>
                <Drawer.Footer className="flex justify-between items-center">
                    <div className="flex gap-2">
                    <Drawer.Close asChild>
                        <Button variant="secondary">Close</Button>
                    </Drawer.Close>
                    <Button onClick={() => window.open(`/app/orders/${originalId}`, '_blank')}>
                            Original Order
                        </Button>
                    </div>

                    {/* 🔥 NÚT REMIT COD DÀNH CHO ADMIN 🔥 */}
                    {blockchainOrder.payment_method === 'COD' && blockchainOrder.cod_status === 'PENDING_REMITTANCE' && (
                        <Button 
                            variant="primary" 
                            onClick={handleRemitCOD} 
                            isLoading={isRemitting}
                        >
                            <CurrencyDollar /> Confirm COD Payment
                    </Button>
                    )}
                </Drawer.Footer>
            </Drawer.Content>
        </Drawer>
    );
};

// --- MAIN COMPONENT ---
type SortKey = 'blockchain_id' | 'created_at' | 'updated_at';
type SortDirection = 'asc' | 'desc';

const BlockchainOrderList = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  
  // State quản lý việc mở Drawer chi tiết
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/admin/fabric/orders/list`, {
            method: "GET", credentials: "include"
        });
        if (res.ok) {
            const data = await res.json();
                setOrders(data.orders || []);
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
          const searchLower = searchQuery.toLowerCase();
          
          const matchSearch = 
            (o.blockchain_id || "").toLowerCase().includes(searchLower) || 
            (o.seller_id || "").toLowerCase().includes(searchLower);

          const matchStatus = statusFilter === "ALL" || status === statusFilter;
          const matchPayment = paymentFilter === "ALL" || payment === paymentFilter;

          return matchSearch && matchStatus && matchPayment;
      });

      return filtered.sort((a, b) => {
          let aVal: any;
          let bVal: any;

          if (sortKey === 'blockchain_id') {
              aVal = a.blockchain_id;
              bVal = b.blockchain_id;
          } else if (sortKey === 'updated_at') {
              aVal = a.updated_at ? new Date(a.updated_at).getTime() : new Date(a.created_at).getTime();
              bVal = b.updated_at ? new Date(b.updated_at).getTime() : new Date(b.created_at).getTime();
          } else {
              aVal = new Date(a.created_at).getTime();
              bVal = new Date(b.created_at).getTime();
          }

          if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
          return 0;
      });
  }, [orders, searchQuery, statusFilter, paymentFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(processedOrders.length / ITEMS_PER_PAGE);
  const paginatedOrders = processedOrders.slice(
      (currentPage - 1) * ITEMS_PER_PAGE, 
      currentPage * ITEMS_PER_PAGE
  );

  const formatDate = (dateString: string) => {
      if (!dateString) return "-";
      return new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' });
  };

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>Loading Blockchain Ledger...</div>;
  if (errorMsg) return <div style={{ padding: 20, color: 'red' }}>{errorMsg}</div>;

  return (
    <ErrorBoundary>
        <div style={{ width: '100%', fontFamily: 'Inter, sans-serif', marginBottom: 50, color: '#111827' }}>
        
        <style dangerouslySetInnerHTML={{__html: `
            main h1 { display: none !important; }
            .medusa-widget-zone ~ div { display: none !important; }
            main > div > div:nth-child(2) { display: none !important; }
        `}} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 8 }}>
            <div>
                <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Blockchain Ledger</h1>
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Live tracking of split orders from Hyperledger Fabric</p>
            </div>
            <Button onClick={fetchData} variant="secondary">Refresh</Button>
        </div>

        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}>
            
            {/* TOOLBAR */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 10, alignItems: 'center', background: '#fff' }}>
                <input 
                    placeholder="Search ID / Seller..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, width: 220, outline: 'none' }} 
                />
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, background: '#f9fafb', cursor: 'pointer' }}>
                    <option value="ALL">All Status</option>
                    <option value="CREATED">Created</option>
                    <option value="PAID">Paid</option>
                    <option value="SHIPPED">Shipped</option>
                    <option value="DELIVERED">Delivered</option>
                    <option value="SETTLED">Settled</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="RETURNED">Returned</option>
                </select>
                <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, background: '#f9fafb', cursor: 'pointer' }}>
                    <option value="ALL">All Payment</option>
                    <option value="PREPAID">Prepaid</option>
                    <option value="COD">COD</option>
                </select>

                <div style={{ flex: 1 }}></div>

                <div style={{ position: 'relative' }} ref={sortMenuRef}>
                    <button onClick={() => setShowSortMenu(!showSortMenu)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, border: '1px solid #e5e7eb', borderRadius: 6, background: 'white', cursor: 'pointer' }}>
                        <Icons.Sort />
                    </button>
                    {showSortMenu && (
                        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, width: 180, background: 'white', border: '1px solid #e5e7eb', borderRadius: 6, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', zIndex: 50, padding: '4px 0' }}>
                            <div style={{ padding: '4px 12px', fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase' }}>Sort By</div>
                            {[
                                { label: 'Blockchain ID', key: 'blockchain_id' },
                                { label: 'Created Date', key: 'created_at' },
                                { label: 'Updated Date', key: 'updated_at' },
                            ].map((item) => (
                                <div key={item.key} onClick={() => { setSortKey(item.key as SortKey); setShowSortMenu(true); }} style={{ padding: '6px 12px', fontSize: 13, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: sortKey === item.key ? '#f3f4f6' : 'transparent', color: sortKey === item.key ? '#111827' : '#4B5563' }} onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'} onMouseOut={(e) => e.currentTarget.style.background = sortKey === item.key ? '#f3f4f6' : 'transparent'}>
                                    {item.label}
                                    {sortKey === item.key && <Icons.Check />}
                                </div>
                            ))}
                            <div style={{ height: 1, background: '#e5e7eb', margin: '4px 0' }}></div>
                            <div style={{ padding: '4px 12px', fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase' }}>Order</div>
                            {[
                                { label: 'Ascending', dir: 'asc' },
                                { label: 'Descending', dir: 'desc' },
                            ].map((item) => (
                                <div key={item.dir} onClick={() => { setSortDir(item.dir as SortDirection); setShowSortMenu(false); }} style={{ padding: '6px 12px', fontSize: 13, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: sortDir === item.dir ? '#f3f4f6' : 'transparent', color: sortDir === item.dir ? '#111827' : '#4B5563' }} onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'} onMouseOut={(e) => e.currentTarget.style.background = sortDir === item.dir ? '#f3f4f6' : 'transparent'}>
                                    {item.label}
                                    {sortDir === item.dir && <Icons.Check />}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* --- TABLE --- */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead style={{ background: '#F9FAFB', borderBottom: '1px solid #e5e7eb' }}>
                <tr>
                    {['Blockchain ID', 'Date', 'Seller (Shop)', 'Status', 'Payment', 'Info'].map(h => (
                        <th key={h} style={{ padding: '12px 24px', color: '#6b7280', fontSize: 11, fontWeight: 500, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {paginatedOrders.map((o) => {
                    const bStyle = getStatusStyle(o.status);
                    
                    return (
                        <tr key={o.blockchain_id} 
                            style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer', transition: 'background 0.1s' }}
                            onClick={() => setSelectedOrder(o)}
                            onMouseOver={(e) => e.currentTarget.style.background = '#F9FAFB'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                        >
                            <td style={{ padding: '14px 24px', color: '#374151', fontWeight: 500, fontFamily: 'monospace' }}>{o.blockchain_id}</td>
                            <td style={{ padding: '14px 24px', color: '#6b7280' }}>{formatDate(o.created_at)}</td>
                            <td style={{ padding: '14px 24px', color: '#374151' }}>{o.seller_id}</td>
                            
                            <td style={{ padding: '14px 24px' }}>
                                <span style={{ 
                                    padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                                    background: bStyle.bg, color: bStyle.color,
                                    border: `1px solid ${bStyle.border || 'transparent'}`,
                                    whiteSpace: 'nowrap'
                                }}>
                                    {o.status.replace(/_/g, ' ')}
                                </span>
                            </td>

                            <td style={{ padding: '14px 24px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                                    <span style={{ 
                                        fontFamily: 'monospace', fontSize: 11, border: '1px solid #e5e7eb', 
                                        padding: '2px 6px', borderRadius: 4, 
                                        color: o.payment_method === 'COD' ? '#C2410C' : '#1E40AF',
                                        background: o.payment_method === 'COD' ? '#FFF7ED' : '#EFF6FF'
                                    }}>
                                        {o.payment_method || '-'}
                                    </span>
                                    {o.payment_method === 'COD' && (
                                        <span style={{ 
                                            fontSize: 10, fontWeight: 600, padding: '1px 4px', borderRadius: 3,
                                            background: '#fff', border: '1px solid #e5e7eb', color: '#6b7280'
                                        }}>
                                            {o.cod_status || 'PENDING'}
                                        </span>
                                    )}
                                </div>
                            </td>

                            <td style={{ padding: '14px 24px', textAlign: 'right', color: '#9CA3AF', fontStyle: 'italic', fontSize: 12 }}>
                                Click to view
                            </td>
                        </tr>
                    )
                })}
                {paginatedOrders.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>No orders found on Ledger.</td></tr>
                )}
            </tbody>
            </table>

            {/* PAGINATION */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                    Showing {paginatedOrders.length} of {processedOrders.length} results
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: '4px 10px', border: '1px solid #e5e7eb', borderRadius: 4, background: currentPage === 1 ? '#f3f4f6' : 'white', color: currentPage === 1 ? '#9ca3af' : '#374151', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: 12 }}>Prev</button>
                    <span style={{ fontSize: 12, color: '#374151' }}>Page {currentPage} of {totalPages || 1}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} style={{ padding: '4px 10px', border: '1px solid #e5e7eb', borderRadius: 4, background: currentPage >= totalPages ? '#f3f4f6' : 'white', color: currentPage >= totalPages ? '#9ca3af' : '#374151', cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer', fontSize: 12 }}>Next</button>
                </div>
            </div>

            {/* 🔥 DRAWER: HIỂN THỊ CHI TIẾT SUB-ORDER 🔥 */}
            {selectedOrder && (
                <OrderDrawer 
                    blockchainOrder={selectedOrder} 
                    onClose={() => setSelectedOrder(null)}
                    onRefresh={fetchData} 
                />
            )}
        </div>
        </div>
    </ErrorBoundary>
  );
};

export const config = defineWidgetConfig({ zone: "order.list.before" });
export default BlockchainOrderList;