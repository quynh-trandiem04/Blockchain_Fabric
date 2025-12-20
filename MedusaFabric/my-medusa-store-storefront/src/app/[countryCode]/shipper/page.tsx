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
  ),
  Truck: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13"></rect>
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
      <circle cx="5.5" cy="18.5" r="2.5"></circle>
      <circle cx="18.5" cy="18.5" r="2.5"></circle>
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
      codStatus?: string;
      product_lines?: any[];
      updatedAt?: string; 
      amount_untaxed: number;
      sellerCompanyID?: string;
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
  
  // --- STATE ACTION BUTTONS ---
  const [isShipping, setIsShipping] = useState<string | null>(null); // State cho nút lấy hàng
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

    const [settingsForm, setSettingsForm] = useState({
        carrier_name: "",
        phone: "",
        email: "",
        shipping_fee: 10,
    });
    const [isSavingSettings, setIsSavingSettings] = useState(false);

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
      let filtered = orders.filter(o => {
          const status = o.decryptedData?.status || "";
          const payment = o.decryptedData?.paymentMethod || "";
          
          const matchSearch = 
            o.display_id.toLowerCase().includes(searchQuery.toLowerCase()) || 
            o.publicData.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (o.decryptedData?.shipping_phone || "").includes(searchQuery);

          const matchStatus = statusFilter === "ALL" || status === statusFilter;
          const matchPayment = paymentFilter === "ALL" || payment === paymentFilter;

          return matchSearch && matchStatus && matchPayment;
      });

      return filtered.sort((a, b) => {
          let aVal: any;
          let bVal: any;

          if (sortKey === 'display_id') {
              aVal = parseInt(a.display_id.replace(/\D/g, ''), 10);
              bVal = parseInt(b.display_id.replace(/\D/g, ''), 10);
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
          RETURN_IN_TRANSIT: "bg-amber-100 text-amber-700 border-amber-300",
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
      
      const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

      try {
          const res = await fetch(`${BACKEND_URL}/store/market/seller-me`, {
              headers: { 
                  "Authorization": `Bearer ${token}`,
                  "Content-Type": "application/json",
                  "x-publishable-api-key": publishableKey
              }
          })

          if (!res.ok) {
              console.warn("Token invalid or expired.");
              localStorage.removeItem("medusa_token");
              setIsLoggedIn(false);
              setIsAuthorized(false);
              return;
          }
          
          const { user } = await res.json()
          const role = user.metadata?.fabric_role;
          const status = user.metadata?.approver_status;

          console.log(`   -> User Role: ${role} | Status: ${status}`);

          if (role !== 'shipperorgmsp') {
              alert("This account does not have SHIPPER access.");
              setIsAuthorized(false);
              localStorage.removeItem("medusa_token");
              setIsLoggedIn(false);
          } else if (status === 'pending') {
              alert("This account is still pending approval.");
              setIsAuthorized(false);
              localStorage.removeItem("medusa_token");
              setIsLoggedIn(false);
          } else if (status === 'rejected') {
              alert("This account has been rejected.");
              setIsAuthorized(false);
              localStorage.removeItem("medusa_token");
              setIsLoggedIn(false);
          } else {
            //   console.log(`  [ALLOW] Quyền hợp lệ.`);
              setIsAuthorized(true)
              setCurrentUser(user);
              
              setSettingsForm({
                  carrier_name: user.metadata?.carrier_name || "",
                  phone: user.metadata?.phone || "",
                email: user.email || "",
                shipping_fee: user.metadata?.shipping_fee ? parseInt(user.metadata.shipping_fee) : 10
              });
              
              loadShipperOrders(token);
          }
      } catch (e) { 
          console.error("Connection error:", e);
          setIsAuthorized(false);
          localStorage.removeItem("medusa_token");
          setIsLoggedIn(false);
      } finally {
          setIsCheckingRole(false)
      }
  }

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
        setLoginError("Login failed.")
        setIsLoadingLogin(false)
      }
    } catch (err) { 
        setLoginError("Connection error.")
        setIsLoadingLogin(false) 
    } 
  }

  const handleLogout = () => { localStorage.removeItem("medusa_token"); window.location.reload() }

  // --- 2. HÀM XỬ LÝ ACTIONS ---

  // ==> A. HÀM SHIP ORDER (Lấy hàng từ Seller)
  const handleShipOrder = async (orderId: string) => {
      if(!confirm("Confirm that the order has been successfully picked up from the seller and shipping has started?")) return;
      
      setIsShipping(orderId);
      const token = localStorage.getItem("medusa_token");
      const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";
    //   console.log("🔑 Debug API Key:", publishableKey); 

      if (!publishableKey) {
        // alert("Lỗi Config: Thiếu Publishable API Key trong file .env");
        return;
      }
      
      try {
          const res = await fetch(`${BACKEND_URL}/store/fabric/orders/${orderId}/ship`, {
              method: "POST",
              headers: { 
                  "Content-Type": "application/json", 
                  "Authorization": `Bearer ${token}`,
                  "x-publishable-api-key": publishableKey
              }
          });
          
          const result = await res.json();

          if (res.ok) {
              alert("Confirmed: Shipping started!");
              loadShipperOrders(token || "");
              if (selectedOrder?.id === orderId) setSelectedOrder(null);
          } else {
              alert("Error: " + (result.message || result.error || "Unknown error"));
          }
      } catch (err) { 
          alert("Connection error.");
      } finally { 
          setIsShipping(null); 
      }
  }

  // ==> B. HÀM CONFIRM DELIVERY (Giao thành công)
  const handleConfirmDelivery = async (orderId: string, isCod: boolean) => {
    // Xác định endpoint dựa trên loại đơn (COD dùng endpoint riêng để trigger update codStatus)
    const endpoint = isCod ? 'cod-deliver' : 'deliver';
    
    if (!confirm(`Confirm that the order has been successfully delivered? ${isCod ? '(And COD has been collected)' : ''}`)) return;
    
    setIsDelivering(orderId);
    const token = localStorage.getItem("medusa_token");
    
    try {
        const res = await fetch(`${BACKEND_URL}/store/fabric/orders/${orderId}/${endpoint}`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${token}`,
                "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""
            }
        });
        
        const result = await res.json();
        if (res.ok) {
            alert("Delivery confirmed!");
            loadShipperOrders(token || "");
            if (selectedOrder?.id === orderId) setSelectedOrder(null);
        } else {
            alert("❌ Error: " + (result.error || "Failed"));
        }
    } catch (err) { alert("Connection error."); } 
    finally { setIsDelivering(null); }
  }

  const handleShipReturn = async (orderId: string) => {
    if (!confirm("Confirm that the returned item has been successfully collected from the customer?")) return;
    setIsReturning(orderId);
    const token = localStorage.getItem("medusa_token");
    try {
        const res = await fetch(`${BACKEND_URL}/store/fabric/orders/${orderId}/return-ship`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${token}`,
                "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""
            }
        });
        const result = await res.json();
        if (res.ok) {
            alert("Success!");
            loadShipperOrders(token || "");
            if (selectedOrder?.id === orderId) setSelectedOrder(null);
        } else {
            alert("Error: " + (result.error || "Failed"));
        }
    } catch (err) { 
        // alert("Lỗi kết nối server"); 
    } 
    finally { setIsReturning(null); }
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSavingSettings(true);
      const token = localStorage.getItem("medusa_token");
      const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

      try {
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
              alert("Successfully updated settings.");
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
              alert("Error: " + (err.message || "Failed to update"));
          }
      } catch (err) {
          alert("Connection error.");
      } finally {
          setIsSavingSettings(false);
      }
  }
  
  const loadShipperOrders = async (tokenOverride?: string) => {
    setIsLoadingData(true)
    const token = tokenOverride || localStorage.getItem("medusa_token")
    if (!token) return
    const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

    try {
        // 1. Lấy danh sách ID đơn hàng thuộc Shipper này từ Blockchain
        const ordersRes = await fetch(`${BACKEND_URL}/store/market/shipper/orders`, {
            headers: { 
                "Authorization": `Bearer ${token}`,
                "x-publishable-api-key": publishableKey
            }
        })
        // console.log("Orders Res:", ordersRes);
        if (!ordersRes.ok) { 
            console.error("Failed to fetch shipper orders.");
            setIsLoadingData(false); 
            return 
        }

        const { orders: fabricOrders } = await ordersRes.json()
        console.log("Fabric Orders:", fabricOrders);
        const loadedOrders: OrderRow[] = []

        // 2. Loop qua từng đơn để Decrypt thông tin chi tiết
        await Promise.all(
          fabricOrders.map(async (order: any) => {
            const row: OrderRow = {
                id: order.blockchain_id,
                display_id: order.blockchain_id, 
                created_at: new Date(order.created_at).toLocaleDateString('vi-VN'),
                publicData: {
                    email: "Loading...",
                    currency_code: "USD",
                    total: 0,
                    payment_method_id: order.payment_method,
                    fulfillment_status: "unknown",
                    status: order.status
                },
                status: "Pending",
                decryptedData: null
            }

            try {
              // Gọi API Decrypt dành cho Shipper
              const res = await fetch(`${BACKEND_URL}/store/fabric/orders/${order.blockchain_id}/decrypt/shipper`, {
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "x-publishable-api-key": publishableKey
                }
              })
              
              if (res.ok) {
                const data = await res.json()
                row.status = "Success"
                row.decryptedData = data
                
                if (data) {
                    row.decryptedData = {
                        customerName: data.customerName,
                        shipping_address: data.shipping_address,
                        
                        shipping_phone: data.phone || data.shipping_phone || "",
                        
                        shipping_fee: data.shipping_fee || data.shipping_total || 0,
                        
                        cod_amount: data.cod_amount || 0,
                        
                        status: data.status,
                        paymentMethod: data.paymentMethod,
                        amount_untaxed: data.amount_untaxed || 0,
                        sellerCompanyID: data.sellerCompanyID
                    };

                    row.publicData.email = data.customerName; 
                    row.publicData.status = data.status;
                }
              } else {
                row.status = "Error"
                row.error = "Decrypt Error"
              }
            } catch (e) { row.status = "Error" }
            loadedOrders.push(row)
          })
        )
        const sortedOrders = loadedOrders.sort((a, b) => b.id.localeCompare(a.id));
        setOrders(sortedOrders)
        
        // Refresh selected order nếu đang mở
        if (selectedOrder) {
            const updated = sortedOrders.find(o => o.id === selectedOrder.id);
            if (updated) setSelectedOrder(updated);
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

    if (isCheckingRole) return <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mb-4"></div><p className="text-gray-600 font-medium">Đang xác thực...</p></div>

  if (isLoggedIn && !isAuthorized) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
            <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md border border-red-100">
                <h1 className="text-2xl font-bold text-red-600 mb-2">ACCESS DENIED</h1>
                <p className="text-gray-600 mb-6">
                    This account does not have access to the <b>SHIPPER</b> page.
                    <br/>Please contact Admin or log in with another account.
                </p>
                <button onClick={handleLogout} className="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 font-bold transition">
                    Logout
                </button>
            </div>
          </div>
      )
  }

    if (!isLoggedIn) {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg border border-gray-100">
            <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mt-2 text-gray-800">
                Shipper Portal
            </h2>
            <p className="text-gray-500 text-sm">Login to receive orders</p>
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
            {loginError && (<div className="text-red-600 text-sm">{loginError}</div>)}
            <button
                type="submit"
                disabled={isLoadingLogin}
                className="w-full bg-orange-600 text-white p-3 rounded-lg hover:bg-orange-700 font-bold"
            >
                Login
            </button>
            </form>
            <div className="text-center mt-6">
            <p className="text-sm text-gray-600">
                Don't have a shipper account?
                <a href="http://localhost:8000/dk/shipper/register" className="ml-1 text-orange-600 font-semibold hover:underline">
                Register now
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
                            <Icons.Truck />
                            <span>Shipper</span>
                        </div>
                    </h1>
                    <p className="text-xs text-gray-500 mt-1 truncate" title={currentUser?.email}>{currentUser?.email}</p>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    <button onClick={() => setActiveTab('orders')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'orders' ? 'bg-orange-50 text-orange-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                        <Icons.Box /> Orders
                    </button>
                    <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-orange-50 text-orange-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                        <Icons.Settings /> Unit Configuration
                    </button>
                </nav>

                <div className="p-4 border-t border-gray-100">
                    <button onClick={handleLogout} className="w-full px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-sm font-medium transition flex items-center justify-center gap-2">
                        <ArrowRightOnRectangle /> Logout
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
                                <h2 className="text-2xl font-bold text-gray-900">Order Management</h2>
                                <p className="text-sm text-gray-500 mt-1">List of assigned orders</p>
                            </div>
                            <button onClick={() => loadShipperOrders()} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium shadow-sm transition flex items-center gap-2">
                                <span className={isLoadingData ? "animate-spin" : ""}>⟳</span>
                            </button>
                        </div>

                        {/* --- TOOLBAR (Filter, Sort, Search) --- */}
                        <div className="flex flex-wrap gap-4 mb-6 items-center justify-between bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                            <div className="flex gap-3 items-center flex-1">
                                {/* Search */}
                                <div className="relative flex-1 max-w-md">
                                    <span className="absolute left-3 top-2.5 text-gray-400"><MagnifyingGlass /></span>
                                    <input
                                        placeholder="Search (Order ID, Email, Phone)..."
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
                                        <option value="ALL">All statuses</option>
                                        <option value="CREATED">Created</option>
                                        <option value="PAID">Paid</option>
                                        <option value="SHIPPED">Shipped</option>
                                        <option value="DELIVERED">Delivered</option>
                                        <option value="RETURN_REQUESTED">Return Requested</option>
                                        <option value="RETURN_IN_TRANSIT">Return In Transit)</option>
                                        <option value="DELIVERED_COD_PENDING">Delivered (COD Pending)</option>
                                        <option value="COD_REMITTED">COD Remitted</option>
                                        <option value="SETTLED">Settled</option>
                                        <option value="CANCELLED">Cancelled</option>
                                    </select>
                                </div>
                            </div>

                            {/* Sort */}
                            <div className="relative" ref={sortMenuRef}>
                                <button
                                    onClick={() => setShowSortMenu(!showSortMenu)}
                                    className="flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 gap-2 shadow-sm transition"
                                >
                                    <Icons.Sort /> Sort By
                                </button>
                                {showSortMenu && (
                                    <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1 animate-in fade-in zoom-in duration-100">
                                        <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b"></div>
                                        {[
                                            { label: 'Created date', key: 'created_at' },
                                            // { label: 'Order ID', key: 'display_id' },
                                            { label: 'Last updated', key: 'updated_at' }
                                        ].map((item) => (
                                            <div
                                                key={item.key}
                                                onClick={() => { setSortKey(item.key as SortKey); setShowSortMenu(true); }}
                                                className={`px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 flex justify-between ${sortKey === item.key ? 'text-orange-600 font-medium' : 'text-gray-700'}`}
                                            >
                                                {item.label} {sortKey === item.key && <Icons.Check />}
                                            </div>
                                        ))}
                                        <div className="h-px bg-gray-100 my-1"></div>
                                        {[ { label: 'Newest / Descending', dir: 'desc' }, { label: 'Oldest / Ascending', dir: 'asc' } ].map((item) => (
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
                                        <th className="px-6 py-4">Order ID</th>
                                        <th className="px-6 py-4">Created date</th>
                                        <th className="px-6 py-4">Customer</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Shipping / COD Fee</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {processedOrders.length === 0 && !isLoadingData ? (
                                        <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">Không tìm thấy đơn hàng nào.</td></tr>
                                    ) : (
                                        processedOrders.map((order) => (
                                            <tr key={order.id} onClick={() => setSelectedOrder(order)} className="hover:bg-orange-50 cursor-pointer transition-colors">
                                                <td className="px-6 py-4 text-sm font-bold text-black-600 font-mono">{order.display_id}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500">{order.created_at}</td>
                                                <td className="px-6 py-4 text-sm text-gray-700">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{order.decryptedData?.customerName || "Hidden"}</span>
                                                        <span className="text-xs text-gray-400">{order.decryptedData?.shipping_phone || "..."}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">{order.decryptedData ? getBlockchainStatusBadge(order.decryptedData.status) : <span className="text-xs bg-gray-100 px-2 py-1 rounded">Syncing...</span>}</td>
                                                <td className="px-6 py-4 text-sm text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="font-medium">{order.decryptedData ? formatPrice(order.decryptedData.shipping_fee, order.publicData.currency_code) : "-"}</span>
                                                        {order.decryptedData?.paymentMethod === 'COD' && (
                                                            <span className="text-[10px] text-orange-600 bg-orange-50 px-1 rounded">COD: {formatPrice(order.decryptedData.cod_amount, order.publicData.currency_code)}</span>
                                                        )}
                                                    </div>
                                                </td>
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
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Carrier setting</h2>
                        <p className="text-gray-500 mb-8">This information will be displayed to customers when selecting a shipping method.</p>

                        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
                            <form onSubmit={handleSaveSettings} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Tên hiển thị (Carrier Name)</label>
                                    <input
                                        type="text"
                                        value={settingsForm.carrier_name}
                                        onChange={(e) => setSettingsForm({ ...settingsForm, carrier_name: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none transition"
                                        placeholder="Ex: FastExpress Logistics"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone number</label>
                                    <input
                                        type="text"
                                        value={settingsForm.phone}
                                        onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none transition"
                                        placeholder="Support Phone Number"
                                    />
                                </div>

                                {/* ========= NEW: SHIPPING FEE ========= */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Shipping Fee</label>
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
                                    <p className="text-xs text-gray-500 mt-1">This fee will be applied to all orders using your shipping service.</p>
                                </div>
                                {/* ===================================== */}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Email (Cannot be edited)</label>
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
                                        {isSavingSettings ? <><Spinner className="animate-spin w-4 h-4"/> Saving...</> : "Save changes"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

            </main>

            {/* Modal Chi Tiết */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    {/* ... (Nội dung modal chi tiết đơn hàng giữ nguyên như cũ hoặc update theo style mới) ... */}
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-lg text-gray-900">Order {selectedOrder.display_id}</h3>
                                <p className="text-xs text-gray-500">{selectedOrder.created_at}</p>
                            </div>
                            <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-700 transition"><XMark /></button>
                        </div>
                        <div className="p-6 max-h-[70vh] overflow-y-auto">
                            {/* Customer */}
                            <div className="mb-6 bg-orange-50 p-4 rounded-lg border border-orange-100">
                                <p className="text-sm font-bold text-black-900 mb-1">Customer</p>
                                <p className="text-sm text-black-800">{selectedOrder.decryptedData?.customerName}</p>
                                {/* Display Phone Number */}
                                    {selectedOrder.decryptedData?.shipping_phone && (
                                        <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border border-orange-200 text-orange-700">
                                            📞 {selectedOrder.decryptedData.shipping_phone}
                                        </span>
                                    )}
                                <p className="text-xs text-black-600 mt-1">{selectedOrder.decryptedData?.shipping_address}</p>
                                <p className="text-xs text-black-600 font-mono">{selectedOrder.decryptedData?.shipping_phone}</p>
                            </div>

                            {/* Totals */}
                            <div className="border-t border-gray-200 pt-4 space-y-1 text-sm">
                                <div className="flex justify-between text-gray-600">
                                    <span>Shipping Fee</span>
                                    <span>{formatPrice(selectedOrder.decryptedData?.shipping_fee, selectedOrder.publicData.currency_code)}</span>
                                </div>
                                <div className="flex justify-between text-gray-600">
                                    <span>Cash on Delivery (COD)</span>
                                    <span>
                                    {formatPrice(
                                        selectedOrder.decryptedData?.paymentMethod === "COD"
                                        ? (selectedOrder.decryptedData?.cod_amount || 0) -
                                            (selectedOrder.decryptedData?.shipping_fee || 0)
                                        : 0,
                                        selectedOrder.publicData.currency_code
                                    )}
                                    </span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="mt-6 flex flex-col gap-3">
                                {/* LOGIC XÁC NHẬN GIAO HÀNG */}

                                {/* BUTTON 1: SHIP ORDER (Lấy hàng từ Seller) 
                                    - COD: Hiện khi status = CREATED (Chưa thu tiền, lấy hàng luôn)
                                    - PREPAID: Hiện khi status = PAID (Khách đã trả tiền Sàn mới cho lấy)
                                */}
                                {((selectedOrder.decryptedData?.paymentMethod === 'COD' && selectedOrder.decryptedData.status === 'CREATED') ||
                                  (selectedOrder.decryptedData?.paymentMethod === 'PREPAID' && selectedOrder.decryptedData.status === 'PAID')) && (
                                    <button 
                                        onClick={() => handleShipOrder(selectedOrder.id)} 
                                        disabled={isShipping === selectedOrder.id} 
                                        className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2.5 rounded-lg font-bold shadow transition flex justify-center items-center gap-2"
                                    >
                                        {isShipping === selectedOrder.id ? (
                                            <Spinner className="animate-spin" />
                                        ) : (
                                            <><Icons.Truck/> Confirm pickup (Ship)</>
                                        )}
                                    </button>
                                )}

                                {/* BUTTON 2: GIAO HÀNG THÀNH CÔNG (PREPAID) */}
                                {selectedOrder.decryptedData?.paymentMethod === 'PREPAID' && selectedOrder.decryptedData.status === 'SHIPPED' && (
                                    <button onClick={() => handleConfirmDelivery(selectedOrder.id, false)} disabled={isDelivering === selectedOrder.id} className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2.5 rounded-lg font-bold shadow transition flex justify-center items-center gap-2">
                                        {isDelivering === selectedOrder.id ? <Spinner className="animate-spin" /> : <><Icons.Truck/> Confirm delivery</>}
                                    </button>
                                )}
                                
                                {/* BUTTON 3: GIAO HÀNG & THU TIỀN (COD) */}
                                {selectedOrder.decryptedData?.paymentMethod === 'COD' && selectedOrder.decryptedData.status === 'SHIPPED' && (
                                    <button onClick={() => handleConfirmDelivery(selectedOrder.id, true)} disabled={isDelivering === selectedOrder.id} className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2.5 rounded-lg font-bold shadow transition flex justify-center items-center gap-2">
                                        {isDelivering === selectedOrder.id ? <Spinner className="animate-spin" /> : <><CurrencyDollar/> Confirm delivery & Collect payment</>}
                                    </button>
                                )}

                                {/* --- 4. LẤY HÀNG HOÀN TRẢ (SHIP RETURN) --- */}
                                {/* Hiển thị khi Khách đã yêu cầu trả hàng (RETURN_REQUESTED) */}
                                {selectedOrder.decryptedData?.status === 'RETURN_REQUESTED' && (
                                    <button 
                                        onClick={() => handleShipReturn(selectedOrder.id)} 
                                        disabled={isReturning === selectedOrder.id} 
                                        className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2.5 rounded-lg font-bold shadow transition flex justify-center items-center gap-2"
                                    >
                                        {isReturning === selectedOrder.id ? (
                                            <Spinner className="animate-spin" />
                                        ) : (
                                            <><Icons.Truck/> Confirm pickup (Return Pickup)</>
                                        )}
                                    </button>
                                )}
                                
                                {/* Trạng thái đang hoàn trả (chỉ hiển thị thông báo) */}
                                {selectedOrder.decryptedData?.status === 'RETURN_IN_TRANSIT' && (
                                    <div className="p-3 bg-indigo-50 text-indigo-700 rounded text-center text-sm font-medium border border-indigo-200">
                                        Return pickup is in transit...
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}