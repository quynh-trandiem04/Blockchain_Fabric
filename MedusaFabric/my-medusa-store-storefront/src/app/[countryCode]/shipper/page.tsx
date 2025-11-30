// my-medusa-store-storefront/src/app/[countryCode]/shipper/page.tsx

"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter, useParams } from "next/navigation"

const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

// --- ICONS ---
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
  ),
  XMark: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  )
};

interface OrderRow {
  id: string;
  display_id: string;
  created_at: string;
  publicData: {
    email: string;
    currency_code: string;
    total: number; 
    payment_method_id: string;
    fulfillment_status: string;
    status: string;
  };
  status: "Pending" | "Success" | "Error";
  // Blockchain Data
  decryptedData: {
      customerName: string;
      shipping_address: string;
      shipping_phone: string;
      shipping_fee: number;
      cod_amount: number;
      status: string;        
      paymentMethod: string; 
      product_lines: any[]; // Thêm trường này để hiển thị chi tiết
      updatedAt?: string; 
  } | null; 
  error?: string;
}

type SortKey = 'display_id' | 'created_at' | 'updated_at';
type SortDirection = 'asc' | 'desc';

export default function ShipperDashboard() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  
  // Router & Params
  const router = useRouter()
  const params = useParams()
  const countryCode = params?.countryCode || "us"

  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isCheckingRole, setIsCheckingRole] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false) 

  // State dữ liệu
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [isLoadingLogin, setIsLoadingLogin] = useState(false)
  const [loginError, setLoginError] = useState("")
  const [isDelivering, setIsDelivering] = useState<string | null>(null);
  
  // State Modal Chi tiết
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);

  // State Filter & Sort
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

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

  // --- LOGIC FILTER & SORT ---
  const processedOrders = useMemo(() => {
      // 1. Filter
      let filtered = orders.filter(o => {
          const status = o.decryptedData?.status || "";
          const payment = o.decryptedData?.paymentMethod || "";
          
          // Search text (ID or Email or Phone)
          const matchSearch = 
            o.display_id.toLowerCase().includes(searchQuery.toLowerCase()) || 
            o.publicData.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (o.decryptedData?.shipping_phone || "").includes(searchQuery);

          const matchStatus = statusFilter === "ALL" || status === statusFilter;
          const matchPayment = paymentFilter === "ALL" || payment === paymentFilter;

          return matchSearch && matchStatus && matchPayment;
      });

      // 2. Sort
      return filtered.sort((a, b) => {
          let aVal: any;
          let bVal: any;

          if (sortKey === 'display_id') {
              aVal = parseInt(a.display_id.replace('#', ''));
              bVal = parseInt(b.display_id.replace('#', ''));
          } else if (sortKey === 'updated_at') {
              // Ưu tiên lấy updated từ blockchain, nếu không có thì lấy created_at
              aVal = new Date(a.decryptedData?.updatedAt || a.created_at).getTime();
              bVal = new Date(b.decryptedData?.updatedAt || b.created_at).getTime();
          } else {
              // created_at
              aVal = new Date(a.created_at).getTime();
              bVal = new Date(b.created_at).getTime();
          }

          if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
          return 0;
      });
  }, [orders, searchQuery, statusFilter, paymentFilter, sortKey, sortDir]);

  const getBlockchainStatusBadge = (status: string) => {
      const styles: Record<string, string> = {
          CREATED: "bg-gray-100 text-gray-700 border-gray-300",
          PAID: "bg-green-100 text-green-700 border-green-300",
          SHIPPED: "bg-blue-100 text-blue-700 border-blue-300",
          DELIVERED: "bg-teal-100 text-teal-700 border-teal-300",
          DELIVERED_COD_PENDING: "bg-orange-100 text-orange-700 border-orange-300",
          COD_REMITTED: "bg-indigo-100 text-indigo-700 border-indigo-300",
          SETTLED: "bg-purple-100 text-purple-700 border-purple-300",
          CANCELLED: "bg-red-100 text-red-700 border-red-300",
          RETURN_REQUESTED: "bg-yellow-100 text-yellow-700 border-yellow-300",
          RETURNED: "bg-pink-100 text-pink-700 border-pink-300"
      };
      
      if (!status) return <span className="text-[10px] text-gray-400">...</span>;

      return (
          <span className={`text-[10px] font-bold px-2 py-1 rounded border border-transparent ${styles[status] || "bg-gray-100"} uppercase shadow-sm`}>
              {status.replace(/_/g, " ")}
          </span>
      );
  }


  // --- 1. HÀM KIỂM TRA ROLE ---
  const checkUserRole = async (token: string) => {
      console.log("🔍 [FE CHECK] Shipper Auth...");
      setIsCheckingRole(true);

      try {
          const res = await fetch(`${BACKEND_URL}/admin/users/me`, {
              headers: { "Authorization": `Bearer ${token}` }
          })

          if (!res.ok) {
              console.warn("Token không hợp lệ/hết hạn. Chuyển hướng về Shop.");
              localStorage.removeItem("medusa_token");
              router.push(`/${countryCode}`);
              return;
          }
          
          const { user } = await res.json()
          const role = user.metadata?.fabric_role;

          console.log(`   -> User Role: ${role}`);

          // CHỈ CHO PHÉP SHIPPER
          if (role !== 'shipperorgmsp' || role === undefined) {
              console.error(`   ⛔ [BLOCK] Role '${role}' bị từ chối.`);
              setIsAuthorized(false)
          } else {
              console.log(`   ✅ [ALLOW] Quyền hợp lệ.`);
              setIsAuthorized(true)
              loadShipperOrders(token)
          }
      } catch (e) { 
          console.error("Lỗi auth:", e);
          setIsAuthorized(false);
          localStorage.removeItem("medusa_token");
          setIsLoggedIn(false);
      } finally {
          setIsCheckingRole(false) // Tắt loading dù thành công hay thất bại
      }
  }

  // Helper Format Tiền
  const formatPrice = (amount: number | undefined, currency: string | undefined) => {
    if (amount === undefined || amount === null) return "0";
    const code = (currency || "USD").toUpperCase();
    try {
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: code }).format(amount); 
    } catch (e) { return `${amount} ${code}`; }
  }
//   const getPaymentLabel = (id: string) => {
//       if (id === 'manual' || id === 'pp_system_default') return 'PREPAID';
//       return id.toUpperCase();
//   }
  const getPaymentLabel = (id: string) => {
      if (id === 'manual' || id === 'pp_system_default' || id === 'PREPAID') return 'PREPAID';
      if (id === 'COD') return 'COD';
      if (id === 'unknown') return 'Checking...';
      return id.toUpperCase();
  }

  // --- HÀM GỌI API GIAO HÀNG ---
  const handleConfirmDelivery = async (orderId: string) => {
      if(!confirm("Xác nhận đã giao hàng thành công cho khách?")) return;

      setIsDelivering(orderId);
      const token = localStorage.getItem("medusa_token");

      try {
          const res = await fetch(`${BACKEND_URL}/admin/fabric/orders/${orderId}/deliver`, {
              method: "POST",
              headers: { 
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${token}`
              }
          });

          const result = await res.json();

          if (res.ok) {
              alert(" Xác nhận giao hàng thành công!");
              loadShipperOrders(token || ""); 
          } else {
              alert(" Lỗi: " + (result.error || "Thất bại"));
          }
      } catch (err) {
          alert(" Lỗi kết nối server");
      } finally {
          setIsDelivering(null);
      }
  }

  useEffect(() => {
    const token = localStorage.getItem("medusa_token")
    if (token) { 
        setIsLoggedIn(true); 
        checkUserRole(token);
    } else {
        setIsCheckingRole(false);
        setIsLoggedIn(false);
    }
  }, [])

  // --- 3. XỬ LÝ LOGIN ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError("")
    setIsLoadingLogin(true)
    try {
      const res = await fetch(`${BACKEND_URL}/auth/user/emailpass`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (res.ok && data.token) {
        localStorage.setItem("medusa_token", data.token)
        setIsLoggedIn(true)
        checkUserRole(data.token);
      } else {
        setLoginError("Đăng nhập thất bại.")
        setIsLoadingLogin(false)
      }
    } catch (err) { 
        setLoginError("Lỗi kết nối.")
        setIsLoadingLogin(false) 
    } 
  }

  const handleLogout = () => { localStorage.removeItem("medusa_token"); window.location.reload() }

  // --- 4. LOAD DỮ LIỆU ---
  const loadShipperOrders = async (tokenOverride?: string) => {
    setIsLoadingData(true)
    const token = tokenOverride || localStorage.getItem("medusa_token")
    if (!token) return

    try {
        const ordersRes = await fetch(`${BACKEND_URL}/admin/orders?limit=20&offset=0&fields=id,display_id,created_at,email,total,currency_code,payment_collections.payment_sessions,fulfillment_status,status`, {
            headers: { "Authorization": `Bearer ${token}` }
        })

        if (!ordersRes.ok) { 
            console.error("Backend block access");
            setIsLoadingData(false); 
            return 
        }

        const { orders: medusaOrders } = await ordersRes.json()
        const loadedOrders: OrderRow[] = []

        await Promise.all(
          medusaOrders.map(async (order: any) => {
            let providerId = 'unknown';
            if (order.payment_collections && order.payment_collections.length > 0) {
                const sessions = order.payment_collections[0].payment_sessions;
                if (sessions && sessions.length > 0) {
                    providerId = sessions[0].provider_id;
                }
            }

            const row: OrderRow = {
                id: order.id,
                display_id: `#${order.display_id}`,
                created_at: new Date(order.created_at).toLocaleDateString('vi-VN'),
                publicData: {
                    email: order.email,
                    currency_code: order.currency_code || "USD",
                    total: order.total,
                    payment_method_id: providerId,
                    fulfillment_status: order.fulfillment_status,
                    status: order.status
                },
                status: "Pending",
                decryptedData: null
            }

            try {
              const res = await fetch(`${BACKEND_URL}/admin/fabric/orders/${order.id}/decrypt/shipper`, {
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
              })
              if (res.ok) {
                const data = await res.json()
                row.status = "Success"
                row.decryptedData = data
                if (row.publicData.payment_method_id === 'unknown' && data.paymentMethod) {
                    row.publicData.payment_method_id = data.paymentMethod;
                }
              } else {
                row.status = "Error"
                row.error = "Chưa đồng bộ Blockchain"
              }
            } catch (e) { row.status = "Error" }
            loadedOrders.push(row)
          })
        )
        setOrders(loadedOrders.sort((a, b) => b.id.localeCompare(a.id)))
    } catch (err) { console.error(err) } finally { setIsLoadingData(false) }
  }

  // =========================================================
  // RENDER GIAO DIỆN
  // =========================================================

  // 1. Loading State
  if (isCheckingRole) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mb-4"></div>
              <p className="text-gray-600 font-medium">Đang xác thực quyền Shipper...</p>
          </div>
      )
  }

  // 2. Access Denied State
  if (isLoggedIn && !isAuthorized) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
            <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md border border-red-100">
                <h1 className="text-2xl font-bold text-red-600 mb-2">TRUY CẬP BỊ TỪ CHỐI</h1>
                <p className="text-gray-600 mb-6">
                    Tài khoản này không có quyền truy cập trang <b>SHIPPER</b>.
                    <br/>Vui lòng liên hệ Admin hoặc đăng nhập tài khoản khác.
                </p>
                <button onClick={handleLogout} className="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 font-bold transition">
                    Đăng xuất
                </button>
            </div>
          </div>
      )
  }

  // 3. Login State
  if (!isLoggedIn) {
      // (Phần Login giữ nguyên)
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
           <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg border border-gray-100">
             <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mt-2 text-gray-800">Cổng Vận Chuyển</h2>
                <p className="text-gray-500 text-sm">Đăng nhập để nhận đơn hàng</p>
             </div>
             <form onSubmit={handleLogin} className="space-y-5">
                 <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full border border-gray-300 p-3 rounded-lg" placeholder="shipper@myfabric.com" required />
                 <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full border border-gray-300 p-3 rounded-lg" placeholder="Password" required />
                 {loginError && <div className="text-red-600 text-sm">{loginError}</div>}
                 <button type="submit" disabled={isLoadingLogin} className="w-full bg-orange-600 text-white p-3 rounded-lg hover:bg-orange-700 font-bold">Login</button>
             </form>
           </div>
        </div>
      )
  }

  // 4. Dashboard State
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 relative">
      
      {/* --- MODAL CHI TIẾT ĐƠN HÀNG (CARD STYLE) --- */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200 overflow-hidden">
                
                {/* Modal Header */}
                <div className="bg-orange-50 px-6 py-4 border-b border-orange-100 flex justify-between items-start">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">{selectedOrder.display_id}</h2>
                        <p className="text-xs text-gray-500 mt-1 font-mono">{selectedOrder.id}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{(selectedOrder.created_at)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600 mb-1">
                            <Icons.XMark />
                        </button>
                        {selectedOrder.decryptedData && (
                             <span className="px-2 py-1 bg-white rounded text-[10px] font-bold text-gray-500 border border-orange-200 shadow-sm">
                                {selectedOrder.decryptedData.status}
                             </span>
                        )}
                    </div>
                </div>
                
                {/* Modal Body */}
                <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                    {/* Customer Info */}
                    <div className="flex items-start gap-3">
                         <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-lg flex-shrink-0">📍</div>
                        <div>
                             <div className="font-bold text-gray-900 text-sm">{selectedOrder.decryptedData?.customerName}</div>
                             <div className="text-sm text-gray-600 mt-1 leading-snug bg-gray-50 p-2 rounded border border-gray-200">
                                 {selectedOrder.decryptedData?.shipping_address}
                             </div>
                             <div className="text-sm text-orange-700 mt-2 font-medium flex items-center gap-1">
                                 📞 {selectedOrder.decryptedData?.shipping_phone}
                             </div>
                        </div>
                    </div>

                    {/* Financials */}
                    <div className="space-y-3 pt-4 border-t border-dashed border-gray-200">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-500 font-medium uppercase">Phí vận chuyển</span>
                            <span className="text-sm font-bold text-gray-800">
                                {formatPrice(selectedOrder.decryptedData?.shipping_fee, selectedOrder.publicData.currency_code)}
                            </span>
                        </div>
                        
                        <div className="flex justify-between items-center bg-orange-50 p-3 rounded-lg border border-orange-100">
                            <span className="text-xs font-bold text-orange-800 uppercase">Cần thu hộ (COD)</span>
                            <span className="text-lg font-bold text-orange-700">
                                {formatPrice(selectedOrder.decryptedData?.cod_amount, selectedOrder.publicData.currency_code)}
                            </span>
                        </div>

                        </div>
                    </div>

                    {/* Nút hành động */}
                    <div className="pt-2">
                        {selectedOrder.decryptedData?.paymentMethod === 'PREPAID' && selectedOrder.decryptedData.status === 'SHIPPED' ? (
                            <button 
                                onClick={() => handleConfirmDelivery(selectedOrder.id)}
                                disabled={isDelivering === selectedOrder.id}
                            className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold shadow-md transition flex items-center justify-center gap-2"
                            >
                            {isDelivering === selectedOrder.id ? "Đang xử lý..." : "XÁC NHẬN ĐÃ GIAO HÀNG"}
                            </button>
                        ) : (
                             <div className="text-center flex justify-center">
                             {['DELIVERED', 'DELIVERED_COD_PENDING', 'COD_REMITTED', 'SETTLED'].includes(selectedOrder.decryptedData?.status || "") ? (
                                     <span className="inline-flex items-center px-3 py-1.5 rounded text-sm font-medium bg-teal-50 text-teal-700 border border-teal-100">
                                         Successfully Delivered
                                     </span>
                             ) : (
                                     <span className="text-xs text-gray-400 italic">Chờ xử lý...</span>
                                 )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
      )}

      {/* --- MAIN LAYOUT --- */}
      <nav className="bg-white border-b px-8 py-4 flex justify-between items-center shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">Shipper Dashboard</h1>
        </div>
        <div className="flex gap-3">
            <button onClick={() => loadShipperOrders()} className="px-4 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium transition">
                {isLoadingData ? "..." : "Làm mới"}
            </button>
            <button onClick={handleLogout} className="px-4 py-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 text-sm font-medium transition">Thoát</button>
        </div>
      </nav>

      <div className="p-8 max-w-7xl mx-auto">
         
         {/* --- TOOLBAR --- */}
         <div className="flex flex-wrap gap-4 mb-6 items-center justify-between">
             <div className="flex gap-3 items-center">
                {/* Search */}
                <input 
                    placeholder="Search" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none w-64 bg-white shadow-sm" 
                />
                {/* Filter Status */}
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white shadow-sm cursor-pointer outline-none">
                    <option value="ALL">All Status</option>
                    <option value="CREATED">Created</option>
                    <option value="PAID">Paid</option>
                    <option value="SHIPPED">Shipped</option>
                    <option value="DELIVERED">Delivered</option>
                    <option value="SETTLED">Settled</option>
                    <option value="COD_REMITTED">COD Remitted</option>
                    <option value="DELIVERED_COD_PENDING">Delivered COD Pending</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="RETURNED">Returned</option>
                    <option value="RETURN_REQUESTED">Return Requested</option>
               </select>
                {/* Filter Payment */}
                <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white shadow-sm cursor-pointer outline-none">
                    <option value="ALL">All Payment</option>
                    <option value="PREPAID">Prepaid</option>
                    <option value="COD">COD</option>
                </select>
              </div>

             {/* Sort */}
             <div className="relative" ref={sortMenuRef}>
                <button 
                    onClick={() => setShowSortMenu(!showSortMenu)}
                    className="flex items-center justify-center w-9 h-9 border border-gray-300 rounded-md bg-white hover:bg-gray-50 transition shadow-sm"
                >
                    <Icons.Sort />
                </button>
                
                {showSortMenu && (
                    <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1">
                        <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b">Sort By</div>
                        {[
                            { label: 'Display ID', key: 'display_id' },
                            { label: 'Created Date', key: 'created_at' },
                            { label: 'Updated Date', key: 'updated_at' },
                        ].map((item) => (
                            <div key={item.key} onClick={() => { setSortKey(item.key as SortKey); setShowSortMenu(true); }} className={`px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 flex justify-between ${sortKey === item.key ? 'font-medium text-orange-600' : 'text-gray-700'}`}>
                                {item.label} {sortKey === item.key && <Icons.Check />}
                            </div>
                        ))}
                        <div className="h-px bg-gray-100 my-1"></div>
                        {[ { label: 'Ascending', dir: 'asc' }, { label: 'Descending', dir: 'desc' } ].map((item) => (
                            <div key={item.dir} onClick={() => { setSortDir(item.dir as SortDirection); setShowSortMenu(false); }} className={`px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 flex justify-between ${sortDir === item.dir ? 'font-medium text-orange-600' : 'text-gray-700'}`}>
                                {item.label} {sortDir === item.dir && <Icons.Check />}
                            </div>
                        ))}
                    </div>
                )}
             </div>
         </div>

         {/* --- TABLE VIEW (MEDUSA STYLE) --- */}
         <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <th className="px-6 py-3 font-medium">Order</th>
                        <th className="px-6 py-3 font-medium">Date</th>
                        <th className="px-6 py-3 font-medium">Customer</th>
                        <th className="px-6 py-3 font-medium">Status</th>
                        <th className="px-6 py-3 font-medium">Payment</th>
                        <th className="px-6 py-3 font-medium text-right">Shipping Fee</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                    {processedOrders.length === 0 && !isLoadingData ? (
                        <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-500">No orders found.</td></tr>
                    ) : (
                        processedOrders.map((order) => (
                            <tr 
                                key={order.id} 
                                onClick={() => setSelectedOrder(order)}
                                className="hover:bg-gray-50 cursor-pointer transition-colors group"
                            >
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                    {order.display_id}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    {(order.created_at)}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-700">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold">
                                            {(order.decryptedData?.customerName || order.publicData.email).charAt(0).toUpperCase()}
                                        </div>
                                        {order.publicData.email || order.decryptedData?.customerName}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {order.status === "Success" && order.decryptedData ? (
                                        getBlockchainStatusBadge(order.decryptedData.status)
                                    ) : (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                            SYNCING
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {order.status === "Success" && order.decryptedData ? (
                                        <span className="inline-block text-[10px] font-mono text-gray-500 border border-gray-200 px-2 py-0.5 rounded">
                                            {order.decryptedData.paymentMethod}
                                        </span>
                                    ) : null}
                                </td>
                                <td className="px-6 py-4 text-sm text-right text-gray-700 font-medium">
                                    {order.decryptedData 
                                        ? formatPrice(order.decryptedData.shipping_fee, order.publicData.currency_code) 
                                        : "-"}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
            
            {/* Footer Pagination Giả Lập */}
            <div className="px-6 py-3 border-t border-gray-200 bg-white flex items-center justify-between">
                <span className="text-xs text-gray-500">Showing {processedOrders.length} results</span>
                <div className="flex gap-2">
                    <button disabled className="px-3 py-1 border border-gray-300 rounded text-xs text-gray-400 bg-gray-50 cursor-not-allowed">Prev</button>
                    <button disabled className="px-3 py-1 border border-gray-300 rounded text-xs text-gray-400 bg-gray-50 cursor-not-allowed">Next</button>
                    </div>
            </div>
         </div>

      </div>
    </div>
  )
}