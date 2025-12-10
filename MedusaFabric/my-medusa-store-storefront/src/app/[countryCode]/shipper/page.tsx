// my-medusa-store-storefront/src/app/[countryCode]/shipper/page.tsx

"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
// Import Icons
import {
    MagnifyingGlass, Funnel, Spinner, XMark, CheckCircle, RocketLaunch,
    ArrowRightOnRectangle, User, CurrencyDollar
} from "@medusajs/icons"

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
    Box: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
    ),
    Settings: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
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
      product_lines: any[];
      updatedAt?: string; 
      amount_untaxed: number;
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
    const [currentUser, setCurrentUser] = useState<any>(null);

    // State Tab
    const [activeTab, setActiveTab] = useState<'orders' | 'settings'>('orders');

    // State dữ liệu Orders
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [isLoadingLogin, setIsLoadingLogin] = useState(false)
  const [loginError, setLoginError] = useState("")
  const [isDelivering, setIsDelivering] = useState<string | null>(null);
  const [isReturning, setIsReturning] = useState<string | null>(null);
  
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

    // State Form Settings
    const [settingsForm, setSettingsForm] = useState({
        carrier_name: "",
        phone: "",
        email: "",
        shipping_fee: 10, // Default value
    });
    const [isSavingSettings, setIsSavingSettings] = useState(false);

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
    }, [orders, searchQuery, statusFilter, sortKey, sortDir]);

  // Helper Format Tiền
  const formatPrice = (amount: number | undefined, currency: string | undefined) => {
    if (amount === undefined || amount === null) return "0";
    const code = (currency || "USD").toUpperCase();
    try {
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: code }).format(amount); 
    } catch (e) { return `${amount} ${code}`; }
  }
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
      
      // Lấy Publishable Key (Bắt buộc cho các request /store)
      const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

      try {
          // (API seller-me được viết generic, trả về user info dựa trên token nên dùng chung được)
          const res = await fetch(`${BACKEND_URL}/store/market/seller-me`, {
              headers: { 
                  "Authorization": `Bearer ${token}`,
                  "Content-Type": "application/json",
                  "x-publishable-api-key": publishableKey
              }
          })

          if (!res.ok) {
              console.warn("Token không hợp lệ hoặc hết hạn.");
              localStorage.removeItem("medusa_token");
              // Reset state để hiện form login
              setIsLoggedIn(false);
              setIsAuthorized(false);
              return;
          }
          
          const { user } = await res.json()
          const role = user.metadata?.fabric_role;
          const status = user.metadata?.approver_status;

          console.log(`   -> User Role: ${role} | Status: ${status}`);

          if (role !== 'shipperorgmsp') {
              alert("Tài khoản này không phải là Shipper.");
              setIsAuthorized(false);
              localStorage.removeItem("medusa_token");
              setIsLoggedIn(false);
          } else if (status === 'pending') {
              alert("Tài khoản đang chờ Admin phê duyệt. Vui lòng quay lại sau.");
              setIsAuthorized(false);
              localStorage.removeItem("medusa_token");
              setIsLoggedIn(false);
          } else if (status === 'rejected') {
              alert("Tài khoản của bạn đã bị từ chối.");
              setIsAuthorized(false);
              localStorage.removeItem("medusa_token");
              setIsLoggedIn(false);
          } else {
              console.log(`   ✅ [ALLOW] Quyền hợp lệ.`);
              setIsAuthorized(true)
              setCurrentUser(user);
              
              // Init Settings Form
              setSettingsForm({
                  carrier_name: user.metadata?.carrier_name || "",
                  phone: user.metadata?.phone || "",
                email: user.email || "",
                // Lấy fee từ metadata, nếu không có thì mặc định 10
                shipping_fee: user.metadata?.shipping_fee ? parseInt(user.metadata.shipping_fee) : 10
              });
              
              // Load dữ liệu
              loadShipperOrders(token, user.metadata?.company_code);
          }
      } catch (e) { 
          console.error("Lỗi kết nối Auth:", e);
          setIsAuthorized(false);
          localStorage.removeItem("medusa_token");
          setIsLoggedIn(false);
      } finally {
          setIsCheckingRole(false)
      }
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

  const handleConfirmDelivery = async (orderId: string) => {
    if (!confirm("Xác nhận đã giao hàng thành công cho khách?")) return;
    setIsDelivering(orderId);
    const token = localStorage.getItem("medusa_token");
    try {
        const res = await fetch(`${BACKEND_URL}/admin/fabric/orders/${orderId}/deliver`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        });
        const result = await res.json();
        if (res.ok) {
            loadShipperOrders(token || "", currentUser?.metadata?.company_code);
        } else {
            alert(" Lỗi: " + (result.error || "Thất bại"));
        }
    } catch (err) { alert(" Lỗi kết nối server"); } finally { setIsDelivering(null); }
  }

  const handleShipReturn = async (orderId: string) => {
    if (!confirm("Xác nhận đã lấy hàng trả từ khách thành công?")) return;
    setIsReturning(orderId);
    const token = localStorage.getItem("medusa_token");
    try {
        const res = await fetch(`${BACKEND_URL}/admin/fabric/orders/${orderId}/return-ship`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        });
        const result = await res.json();
        if (res.ok) {
            loadShipperOrders(token || "", currentUser?.metadata?.company_code);
            if (selectedOrder?.id === orderId) setSelectedOrder(null);
        } else {
            alert(" Lỗi: " + (result.error || "Thất bại"));
        }
    } catch (err) { alert(" Lỗi kết nối server"); } finally { setIsReturning(null); }
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSavingSettings(true);
      const token = localStorage.getItem("medusa_token");
      const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

      try {
          // 👇 GỌI API CUSTOM thay vì API Admin
          const res = await fetch(`${BACKEND_URL}/store/market/shipper/update`, {
              method: "POST",
              headers: { 
                  "Content-Type": "application/json", 
                  "Authorization": `Bearer ${token}`,
                  "x-publishable-api-key": publishableKey
              },
              body: JSON.stringify({
                  carrier_name: settingsForm.carrier_name,
                  phone: settingsForm.phone,
                  shipping_fee: settingsForm.shipping_fee 
              })
          });

          if (res.ok) {
              alert("Cập nhật thông tin thành công!");
              // Update local state
              setCurrentUser({
                  ...currentUser,
                  metadata: {
                      ...currentUser.metadata,
                      carrier_name: settingsForm.carrier_name,
                      phone: settingsForm.phone,
                      shipping_fee: settingsForm.shipping_fee
                  }
              });
          } else {
              const err = await res.json();
              alert("Lỗi: " + (err.message || "Không thể cập nhật"));
          }
      } catch (err) {
          alert("Lỗi kết nối.");
      } finally {
          setIsSavingSettings(false);
      }
  }
  
  const loadShipperOrders = async (tokenOverride?: string, carrierCode?: string) => {
    setIsLoadingData(true)
    const token = tokenOverride || localStorage.getItem("medusa_token")
    if (!token) return
    const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

    try {
        const ordersRes = await fetch(`${BACKEND_URL}/store/market/shipper/orders`, {
            headers: { 
                "Authorization": `Bearer ${token}`,
                "x-publishable-api-key": publishableKey
            }
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
        const sortedOrders = loadedOrders.sort((a, b) => b.id.localeCompare(a.id));
        setOrders(sortedOrders)
        if (selectedOrder) {
            const updatedOrder = sortedOrders.find(o => o.id === selectedOrder.id);
            if (updatedOrder) setSelectedOrder(updatedOrder);
        }
    } catch (err) { console.error(err) } finally { setIsLoadingData(false) }
  }

    // Init Effect
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


    // ================= UI RENDERING =================

    // 1. Loading & Error States
    if (isCheckingRole) return <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mb-4"></div><p className="text-gray-600 font-medium">Đang xác thực...</p></div>

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
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg border border-gray-100">
            <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mt-2 text-gray-800">
                Cổng Vận Chuyển
            </h2>
            <p className="text-gray-500 text-sm">Đăng nhập để nhận đơn hàng</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
            <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-300 p-3 rounded-lg"
                placeholder="shipper@myfabric.com"
                required
            />

            <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-300 p-3 rounded-lg"
                placeholder="Password"
                required
            />

            {loginError && (
                <div className="text-red-600 text-sm">{loginError}</div>
            )}

            <button
                type="submit"
                disabled={isLoadingLogin}
                className="w-full bg-orange-600 text-white p-3 rounded-lg hover:bg-orange-700 font-bold"
            >
                Login
            </button>
            </form>

            {/* ====== THÊM MỤC ĐĂNG KÝ Ở ĐÂY ====== */}
            <div className="text-center mt-6">
            <p className="text-sm text-gray-600">
                Chưa có tài khoản?
                <a
                href="http://localhost:8000/dk/shipper/register"
                className="ml-1 text-orange-600 font-semibold hover:underline"
                >
                Đăng ký ngay
                </a>
            </p>
            </div>
        </div>
        </div>
    )
    }

    // 3. Dashboard Main UI
    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-800 flex">

            {/* --- SIDEBAR MENU --- */}
            <aside className="w-64 bg-white border-r border-gray-200 h-screen sticky top-0 flex flex-col shadow-sm z-30">
                <div className="p-6 border-b border-gray-100">
                    <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <div className="flex items-center gap-2 text-gray-900">
                            {/* SVG TRUCK */}
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                            <span>Shipper</span>
                        </div>
                    </h1>
                    <p className="text-xs text-gray-500 mt-1 truncate" title={currentUser?.email}>{currentUser?.email}</p>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'orders' ? 'bg-orange-50 text-orange-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <Icons.Box /> Đơn hàng
                    </button>

                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-orange-50 text-orange-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <Icons.Settings /> Cấu hình đơn vị
                    </button>
                </nav>

                <div className="p-4 border-t border-gray-100">
                    <button onClick={handleLogout} className="w-full px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-sm font-medium transition flex items-center justify-center gap-2">
                        <ArrowRightOnRectangle /> Đăng xuất
                    </button>
                </div>
            </aside>

            {/* --- MAIN CONTENT AREA --- */}
            <main className="flex-1 p-8 overflow-y-auto h-screen">

                {/* TAB ORDERS */}
                {activeTab === 'orders' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex justify-between items-end mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Quản lý Đơn hàng</h2>
                                <p className="text-sm text-gray-500 mt-1">Danh sách đơn hàng cần giao</p>
                            </div>
                            <button onClick={() => loadShipperOrders()} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium shadow-sm transition flex items-center gap-2">
                                <span className={isLoadingData ? "animate-spin" : ""}>⟳</span> Làm mới
                            </button>
                        </div>

                        {/* --- TOOLBAR (Filter, Sort, Search) --- */}
                        <div className="flex flex-wrap gap-4 mb-6 items-center justify-between bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                            <div className="flex gap-3 items-center flex-1">
                                {/* Search */}
                                <div className="relative flex-1 max-w-md">
                                    <span className="absolute left-3 top-2.5 text-gray-400"><MagnifyingGlass /></span>
                                    <input
                                        placeholder="Tìm kiếm (Mã đơn, Email, SĐT)..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 outline-none"
                                    />
                                </div>
                                <div className="h-8 w-px bg-gray-200 mx-1"></div>
                                {/* Filter Status */}
                                <div className="flex items-center gap-2">
                                    <Funnel className="text-gray-400 w-4 h-4" />
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        className="border-none bg-transparent text-sm font-medium text-gray-700 cursor-pointer focus:ring-0 outline-none hover:text-orange-600 transition"
                                    >
                                        <option value="ALL">Tất cả trạng thái</option>
                                        <option value="SHIPPED">Đang giao (Shipped)</option>
                                        <option value="DELIVERED">Đã giao (Delivered)</option>
                                        <option value="RETURN_REQUESTED">Yêu cầu hoàn trả</option>
                                        <option value="RETURNED">Đã hoàn trả</option>
                                    </select>
                                </div>
                            </div>

                            {/* Sort */}
                            <div className="relative" ref={sortMenuRef}>
                                <button
                                    onClick={() => setShowSortMenu(!showSortMenu)}
                                    className="flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 gap-2 shadow-sm transition"
                                >
                                    <Icons.Sort /> Sắp xếp
                                </button>
                                {showSortMenu && (
                                    <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1 animate-in fade-in zoom-in duration-100">
                                        <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b">Tiêu chí</div>
                                        {[
                                            { label: 'Ngày tạo', key: 'created_at' },
                                            { label: 'Mã đơn', key: 'display_id' },
                                            { label: 'Cập nhật cuối', key: 'updated_at' }
                                        ].map((item) => (
                                            <div
                                                key={item.key}
                                                onClick={() => { setSortKey(item.key as SortKey); setShowSortMenu(true); }} // Keep menu open to select direction
                                                className={`px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 flex justify-between ${sortKey === item.key ? 'text-orange-600 font-medium' : 'text-gray-700'}`}
                                            >
                                                {item.label} {sortKey === item.key && <Icons.Check />}
                                            </div>
                                        ))}
                                        <div className="h-px bg-gray-100 my-1"></div>
                                        {[ { label: 'Mới nhất / Giảm dần', dir: 'desc' }, { label: 'Cũ nhất / Tăng dần', dir: 'asc' } ].map((item) => (
                                            <div
                                                key={item.dir}
                                                onClick={() => { setSortDir(item.dir as SortDirection); setShowSortMenu(false); }}
                                                className={`px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 flex justify-between ${sortDir === item.dir ? 'text-orange-600 font-medium' : 'text-gray-700'}`}
                                            >
                                                {item.label} {sortDir === item.dir && <Icons.Check />}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Table */}
                        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        <th className="px-6 py-4">Mã đơn</th>
                                        <th className="px-6 py-4">Ngày tạo</th>
                                        <th className="px-6 py-4">Khách hàng</th>
                                        <th className="px-6 py-4">Trạng thái</th>
                                        <th className="px-6 py-4 text-right">Phí Ship</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {processedOrders.length === 0 && !isLoadingData ? (
                                        <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">Không tìm thấy đơn hàng nào.</td></tr>
                                    ) : (
                                        processedOrders.map((order) => (
                                            <tr key={order.id} onClick={() => setSelectedOrder(order)} className="hover:bg-orange-50 cursor-pointer transition-colors">
                                                <td className="px-6 py-4 text-sm font-bold text-gray-900">{order.display_id}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500">{order.created_at}</td>
                                                <td className="px-6 py-4 text-sm text-gray-700">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{order.decryptedData?.customerName || order.publicData.email}</span>
                                                        <span className="text-xs text-gray-400">{order.decryptedData?.shipping_phone}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">{order.decryptedData ? getBlockchainStatusBadge(order.decryptedData.status) : <span className="text-xs bg-gray-100 px-2 py-1 rounded">Syncing...</span>}</td>
                                                <td className="px-6 py-4 text-sm text-right font-medium">{order.decryptedData ? formatPrice(order.decryptedData.shipping_fee, order.publicData.currency_code) : "-"}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                            {/* Pagination Placeholder */}
                            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
                                <span>Hiển thị {processedOrders.length} đơn hàng</span>
                                {/* Add pagination logic if needed */}
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB SETTINGS */}
                {activeTab === 'settings' && (
                    <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Cấu hình Đơn vị Vận chuyển</h2>
                        <p className="text-gray-500 mb-8">Thông tin này sẽ được hiển thị cho khách hàng khi chọn phương thức vận chuyển.</p>

                        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
                            <form onSubmit={handleSaveSettings} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Tên hiển thị (Carrier Name)</label>
                                    <input
                                        type="text"
                                        value={settingsForm.carrier_name}
                                        onChange={(e) => setSettingsForm({ ...settingsForm, carrier_name: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none transition"
                                        placeholder="Ví dụ: Giao Hàng Nhanh"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Số điện thoại liên hệ</label>
                                    <input
                                        type="text"
                                        value={settingsForm.phone}
                                        onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none transition"
                                        placeholder="Hotline hỗ trợ"
                                    />
                                </div>

                                {/* ========= NEW: SHIPPING FEE ========= */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Phí Vận Chuyển Mặc Định</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                            <CurrencyDollar />
                                        </div>
                                        <input
                                            type="number"
                                            value={settingsForm.shipping_fee}
                                            onChange={(e) => setSettingsForm({ ...settingsForm, shipping_fee: parseInt(e.target.value) || 0 })}
                                            className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none transition"
                                            placeholder="10"
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Phí này sẽ được áp dụng cho tất cả đơn hàng sử dụng dịch vụ của bạn.</p>
                                </div>
                                {/* ===================================== */}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Email (Không thể sửa)</label>
                                    <input
                                        type="email"
                                        value={settingsForm.email}
                                        disabled
                                        className="w-full border border-gray-200 bg-gray-100 rounded-lg px-4 py-2.5 text-gray-500 cursor-not-allowed"
                                    />
                                </div>

                                <div className="pt-4 border-t border-gray-100 flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={isSavingSettings}
                                        className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg shadow-sm transition disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {isSavingSettings ? <><Spinner className="animate-spin w-4 h-4"/> Đang lưu...</> : "Lưu thay đổi"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

            </main>

            {/* Modal Chi Tiết (Giữ nguyên) */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    {/* ... (Nội dung modal chi tiết đơn hàng giữ nguyên như cũ hoặc update theo style mới) ... */}
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-lg text-gray-900">Đơn hàng {selectedOrder.display_id}</h3>
                                <p className="text-xs text-gray-500">{selectedOrder.created_at}</p>
                            </div>
                            <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-700 transition"><XMark /></button>
                        </div>
                        <div className="p-6 max-h-[70vh] overflow-y-auto">
                            {/* Customer */}
                            <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
                                <p className="text-sm font-bold text-blue-900 mb-1">Khách hàng</p>
                                <p className="text-sm text-blue-800">{selectedOrder.decryptedData?.customerName}</p>
                                <p className="text-xs text-blue-600 mt-1">{selectedOrder.decryptedData?.shipping_address}</p>
                                <p className="text-xs text-blue-600 font-mono">{selectedOrder.decryptedData?.shipping_phone}</p>
                            </div>

                            {/* Products */}
                            <div className="mb-6">
                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Sản phẩm</h4>
                                <ul className="space-y-2">
                                    {selectedOrder.decryptedData?.product_lines.map((p: any, i: number) => (
                                        <li key={i} className="flex justify-between text-sm border-b border-gray-100 pb-2 last:border-0">
                                            <span>{p.product_name} <span className="text-gray-400 text-xs">x{p.quantity}</span></span>
                                            <span className="font-medium">{formatPrice(p.subtotal, selectedOrder.publicData.currency_code)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Totals */}
                            <div className="border-t border-gray-200 pt-4 space-y-1 text-sm">
                                <div className="flex justify-between text-gray-600">
                                    <span>Phí vận chuyển</span>
                                    <span>{formatPrice(selectedOrder.decryptedData?.shipping_fee, selectedOrder.publicData.currency_code)}</span>
                                </div>
                                <div className="flex justify-between text-gray-600">
                                    <span>Thu hộ (COD)</span>
                                    <span>{formatPrice(selectedOrder.decryptedData?.cod_amount, selectedOrder.publicData.currency_code)}</span>
                                </div>
                                <div className="flex justify-between font-bold text-gray-900 text-base mt-2 pt-2 border-t border-gray-100">
                                    <span>Tổng tiền</span>
                                    <span>{formatPrice((selectedOrder.decryptedData?.amount_untaxed || 0) + (selectedOrder.decryptedData?.shipping_fee || 0), selectedOrder.publicData.currency_code)}</span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="mt-6 flex flex-col gap-3">
                                {selectedOrder.decryptedData?.paymentMethod === 'PREPAID' && selectedOrder.decryptedData.status === 'SHIPPED' && (
                                    <button onClick={() => handleConfirmDelivery(selectedOrder.id)} disabled={isDelivering === selectedOrder.id} className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2.5 rounded-lg font-bold shadow transition flex justify-center items-center gap-2">
                                        {isDelivering === selectedOrder.id ? <Spinner className="animate-spin" /> : <><RocketLaunch/> Xác nhận giao hàng</>}
                                    </button>
                                )}
                                {selectedOrder.decryptedData?.status === 'RETURN_IN_TRANSIT' && (
                                    <button onClick={() => handleShipReturn(selectedOrder.id)} disabled={isReturning === selectedOrder.id} className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-bold shadow transition flex justify-center items-center gap-2">
                                        {isReturning === selectedOrder.id ? <Spinner className="animate-spin" /> : <><CheckCircle/> Xác nhận đã nhận hàng hoàn</>}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}