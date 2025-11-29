// my-medusa-store/src/admin/widgets/blockchain-order-list.tsx

import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { useEffect, useState, useMemo, useRef } from "react";

// --- 1. Error Boundary ---
const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  if (hasError) return <div style={{ padding: 20, color: 'red' }}>Widget Error</div>;
  try { return <>{children}</>; } catch (e) { setHasError(true); return null; }
};

// --- 2. Helper Styles (Cập nhật bảng màu đa dạng hơn) ---
const getStatusStyle = (status: string) => {
  const s = (status || "").toUpperCase();

  switch (s) {
    // 1. Mới tạo: Xám/Bạc (Neutral)
    case 'CREATED':
      return { bg: '#F3F4F6', color: '#4B5563', border: '#E5E7EB' }; // Gray

    // 2. Đã thanh toán (Prepaid): Xanh dương (Info/Processing)
    case 'PAID':
      return { bg: '#DBEAFE', color: '#1E40AF', border: '#93C5FD' }; // Blue

    // 3. Đã giao cho vận chuyển: Tím (Transit)
    case 'SHIPPED':
      return { bg: '#F3E8FF', color: '#7E22CE', border: '#D8B4FE' }; // Purple

    // 4. Giao thành công / Hoàn tất: Xanh lá (Success)
    case 'DELIVERED':
    case 'SETTLED':
    case 'COD_REMITTED': // Tiền COD đã về túi
      return { bg: '#DCFCE7', color: '#15803D', border: '#86EFAC' }; // Green

    // 5. Chờ thu tiền COD: Cam (Warning/Action needed)
    case 'DELIVERED_COD_PENDING':
      return { bg: '#FFEDD5', color: '#C2410C', border: '#FDBA74' }; // Orange

    // 6. Hủy / Trả hàng: Đỏ (Error/Destructive)
    case 'CANCELLED':
    case 'RETURNED':
    case 'RETURN_REQUESTED':
      return { bg: '#FEE2E2', color: '#B91C1C', border: '#FCA5A5' }; // Red

    // Mặc định
    default:
      return { bg: '#F9FAFB', color: '#6B7280', border: '#E5E7EB' };
  }
};

// --- 3. Icons (SVG) ---
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

type SortKey = 'display_id' | 'created_at';
type SortDirection = 'asc' | 'desc';

const BlockchainOrderList = () => {
  const [rawOrders, setRawOrders] = useState<any[]>([]);
  const [chainData, setChainData] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Filter & Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  
  // Sort State
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  const ITEMS_PER_PAGE = 10;

  // Click outside to close sort menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- 1. Fetch Data ---
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const res = await fetch(`/admin/orders?limit=50&offset=0&fields=id,display_id,created_at,email,total,currency_code,payment_status,fulfillment_status,status`, {
            method: "GET", credentials: "include"
        });
        
        if (res.ok) {
            const data = await res.json();
            if (isMounted) {
                const list = data.orders || [];
                setRawOrders(list);
                if (list.length > 0) fetchStatuses(list);
                else setIsLoading(false);
            }
        } else {
            if (isMounted) setErrorMsg("Lỗi tải dữ liệu");
        }
      } catch (e) { if (isMounted) setErrorMsg("Lỗi kết nối"); }
    };
    fetchData();
    return () => { isMounted = false; };
  }, []);

  const fetchStatuses = async (list: any[]) => {
    const results: Record<string, any> = {};
    await Promise.all(list.map(async (o) => {
        try {
            const res = await fetch(`/admin/fabric/orders/${o.id}/status`, { credentials: "include" });
            if (res.ok) results[o.id] = await res.json();
            else results[o.id] = { status: "NOT_SYNCED", paymentMethod: "-" };
        } catch { results[o.id] = { status: "ERR", paymentMethod: "-" }; }
    }));
    setChainData(results);
    setIsLoading(false);
  };

  // --- 2. Logic Filter & Sort ---
  const processedOrders = useMemo(() => {
      // Filter
      let filtered = rawOrders.filter(o => {
          const cData = chainData[o.id] || {};
          const status = cData.status || "";
          const payment = cData.paymentMethod || "";

          // Search
          const matchSearch = 
            o.display_id.toString().includes(searchQuery) || 
            (o.email || "").toLowerCase().includes(searchQuery.toLowerCase());

          // Filter Status
          const matchStatus = statusFilter === "ALL" || status === statusFilter;

          // Filter Payment
          const matchPayment = paymentFilter === "ALL" || payment === paymentFilter;

          return matchSearch && matchStatus && matchPayment;
      });

      // Sort
      return filtered.sort((a, b) => {
          let aVal: any = a[sortKey];
          let bVal: any = b[sortKey];

          // Xử lý đặc biệt cho display_id (số) và date
          if (sortKey === 'display_id') {
              aVal = parseInt(aVal, 10);
              bVal = parseInt(bVal, 10);
          } else {
              aVal = new Date(aVal).getTime();
              bVal = new Date(bVal).getTime();
          }

          if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
          return 0;
      });
  }, [rawOrders, chainData, searchQuery, statusFilter, paymentFilter, sortKey, sortDir]);

  // --- 3. Pagination ---
  const totalPages = Math.ceil(processedOrders.length / ITEMS_PER_PAGE);
  const paginatedOrders = processedOrders.slice(
      (currentPage - 1) * ITEMS_PER_PAGE, 
      currentPage * ITEMS_PER_PAGE
  );

  // Helpers
  const formatMoney = (amount: number, currency: string) => {
      if (!amount) return "-";
      return new Intl.NumberFormat('en-US', { 
          style: 'currency', currency: (currency || 'USD').toUpperCase() 
      }).format(amount).replace('EUR', '€');
  };

  const formatDate = (dateString: string) => {
      if (!dateString) return "-";
      return new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>Loading Blockchain Ledger...</div>;
  if (errorMsg) return <div style={{ padding: 20, color: 'red' }}>{errorMsg}</div>;

  return (
    <ErrorBoundary>
        <div style={{ width: '100%', fontFamily: 'Inter, sans-serif', marginBottom: 50, color: '#111827' }}>
        
        {/* CSS Hack ẩn bảng gốc */}
        <style dangerouslySetInnerHTML={{__html: `
            main h1 { display: none !important; }
            .medusa-widget-zone ~ div { display: none !important; }
            main > div > div:nth-child(2) { display: none !important; }
        `}} />

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, marginTop: 8 }}>
            <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Orders</h1>
        </div>

        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}>
            
            {/* TOOLBAR */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 10, alignItems: 'center', background: '#fff' }}>
                <input 
                    placeholder="Search..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, width: 200, outline: 'none' }} 
                />
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, background: '#f9fafb', cursor: 'pointer' }}>
                    <option value="ALL">All Status</option>
                    <option value="CREATED">Created</option>
                    <option value="PAID">Paid</option>
                    <option value="SHIPPED">Shipped</option>
                    <option value="DELIVERED">Delivered</option>
                </select>
                    <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, background: '#f9fafb', cursor: 'pointer' }}>
                    <option value="ALL">All Payment</option>
                    <option value="PREPAID">Prepaid</option>
                    <option value="COD">COD</option>
                </select>

                <div style={{ flex: 1 }}></div>

                    {/* --- SORT BUTTON --- */}
                    <div style={{ position: 'relative' }} ref={sortMenuRef}>
                        <button 
                            onClick={() => setShowSortMenu(!showSortMenu)}
                            style={{ 
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 32, height: 32, border: '1px solid #e5e7eb', borderRadius: 6, 
                                background: 'white', cursor: 'pointer'
                            }}
                        >
                            <Icons.Sort />
                        </button>

                        {/* Sort Menu Dropdown */}
                        {showSortMenu && (
                            <div style={{ 
                                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                                width: 180, background: 'white', border: '1px solid #e5e7eb', 
                                borderRadius: 6, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                zIndex: 50, padding: '4px 0'
                            }}>
                                {[
                                    { label: 'Display ID', key: 'display_id' },
                                    { label: 'Created Date', key: 'created_at' },
                                ].map((item) => (
                                    <div 
                                        key={item.key}
                                        onClick={() => { setSortKey(item.key as SortKey); setShowSortMenu(true); }}
                                        style={{ 
                                            padding: '8px 16px', fontSize: 13, cursor: 'pointer', 
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            background: sortKey === item.key ? '#f9fafb' : 'transparent'
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.background = '#f3f4f6'}
                                        onMouseOut={(e) => e.currentTarget.style.background = sortKey === item.key ? '#f9fafb' : 'transparent'}
                                    >
                                        {item.label}
                                        {sortKey === item.key && <Icons.Check />}
                                    </div>
                                ))}
                                
                                <div style={{ height: 1, background: '#e5e7eb', margin: '4px 0' }}></div>

                                {[
                                    { label: 'Ascending', dir: 'asc' },
                                    { label: 'Descending', dir: 'desc' },
                                ].map((item) => (
                                    <div 
                                        key={item.dir}
                                        onClick={() => { setSortDir(item.dir as SortDirection); setShowSortMenu(false); }}
                                        style={{ 
                                            padding: '8px 16px', fontSize: 13, cursor: 'pointer',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            background: sortDir === item.dir ? '#f9fafb' : 'transparent'
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.background = '#f3f4f6'}
                                        onMouseOut={(e) => e.currentTarget.style.background = sortDir === item.dir ? '#f9fafb' : 'transparent'}
                                    >
                                        {item.label}
                                        {sortDir === item.dir && <Icons.Check />}
                                    </div>
                                ))}
                            </div>
                        )}
                </div>
            </div>

            {/* TABLE */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead style={{ background: '#F9FAFB', borderBottom: '1px solid #e5e7eb' }}>
                <tr>
                    {['Order', 'Date', 'Customer', 'Status', 'Payment', 'Total'].map(h => (
                        <th key={h} style={{ padding: '12px 24px', color: '#6b7280', fontSize: 11, fontWeight: 500, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {paginatedOrders.map((o) => {
                    const cData = chainData[o.id] || {};
                    const bStatus = cData.status || "...";
                    const bStyle = getStatusStyle(bStatus);
                    const customerName = o.email || "Guest";
                    
                    return (
                        <tr key={o.id} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer', transition: 'background 0.1s' }}
                            onClick={() => window.location.href = `/app/orders/${o.id}`}
                            onMouseOver={(e) => e.currentTarget.style.background = '#F9FAFB'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                        >
                            <td style={{ padding: '14px 24px', color: '#111827' }}>#{o.display_id}</td>
                            <td style={{ padding: '14px 24px', color: '#6b7280' }}>{formatDate(o.created_at)}</td>
                            <td style={{ padding: '14px 24px', color: '#374151' }}>{customerName}</td>
                            <td style={{ padding: '14px 24px' }}>
                                <span style={{ 
                                    padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                                    background: bStyle.bg, color: bStyle.color 
                                }}>
                                    {bStatus.replace(/_/g, ' ')}
                                </span>
                            </td>
                            <td style={{ padding: '14px 24px' }}>
                                <span style={{ fontFamily: 'monospace', fontSize: 11, border: '1px solid #e5e7eb', padding: '2px 6px', borderRadius: 4, color: '#4b5563' }}>
                                    {cData.paymentMethod || '-'}
                                </span>
                            </td>
                            <td style={{ padding: '14px 24px', textAlign: 'right', color: '#374151' }}>
                                {formatMoney(o.total, o.currency_code)}
                            </td>
                        </tr>
                    )
                })}
                {paginatedOrders.length === 0 && (
                    <tr>
                        <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>No orders found.</td>
                    </tr>
                )}
            </tbody>
            </table>

            {/* PAGINATION */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                    Showing {paginatedOrders.length} of {processedOrders.length} results
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        style={{ 
                            padding: '4px 10px', border: '1px solid #e5e7eb', borderRadius: 4, 
                            background: currentPage === 1 ? '#f3f4f6' : 'white', 
                            color: currentPage === 1 ? '#9ca3af' : '#374151',
                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: 12 
                        }}
                    >
                        Prev
                    </button>
                    <span style={{ fontSize: 12, color: '#374151' }}>Page {currentPage} of {totalPages || 1}</span>
                    <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        style={{ 
                            padding: '4px 10px', border: '1px solid #e5e7eb', borderRadius: 4, 
                            background: currentPage >= totalPages ? '#f3f4f6' : 'white', 
                            color: currentPage >= totalPages ? '#9ca3af' : '#374151',
                            cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer', fontSize: 12 
                        }}
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
        </div>
    </ErrorBoundary>
  );
};

export const config = defineWidgetConfig({ zone: "order.list.before" });
export default BlockchainOrderList;