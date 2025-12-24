// my-medusa-store-storefront/src/app/[countryCode]/shipper/page.tsx

"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
// Import Icons
import {
    MagnifyingGlass, Funnel, Spinner, XMark, CheckCircle, RocketLaunch,
    ArrowRightOnRectangle, User, CurrencyDollar, Clock, ComputerDesktop, BuildingStorefront
} from "@medusajs/icons"

const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

// --- ICONS ---
const Icons = {
  Sort: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M6 12h12m-9 6h6" />
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

// --- AUDIT TRAIL COMPONENT ---
const AuditTrail = ({ history, sellerId }: { history: any[], sellerId?: string }) => {
    if (!history || !Array.isArray(history) || history.length === 0) {
        return <p className="text-gray-400 italic text-xs">No history recorded.</p>;
    }

    const sortedHistory = [...history].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const getActorName = (org: string) => {
        if (org === 'SellerOrgMSP') return sellerId || "Seller"; 
        if (org === 'ShipperOrgMSP') return "You (Shipper)";
        if (org === 'ECommercePlatformOrgMSP') return "Platform Admin";
        return org;
    };

    const formatAction = (action: string) => {
        if (!action) return "Unknown";
        const spaced = action.replace(/([A-Z])/g, ' $1').trim(); 
        return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
    };

    return (
        <div className="flex flex-col gap-0 relative ml-2 mt-4">
            <div className="absolute left-[15px] top-4 bottom-4 w-px bg-gray-200 -z-10"></div>
            {sortedHistory.map((entry, index) => (
                <div key={index} className="flex gap-4 pb-6 last:pb-0 relative group">
                    <div className="h-8 w-8 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0 z-10">
                        <Clock className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="flex flex-col flex-1 pt-1">
                        <div className="flex justify-between items-start">
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-900">
                                    {formatAction(entry.action)}
                                </span>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 border border-gray-200 font-mono font-medium">
                                        {getActorName(entry.actorOrg)}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        {new Date(entry.timestamp).toLocaleString('en-GB')}
                                    </span>
                                </div>
                            </div>
                        </div>
                        {entry.txID && (
                            <div className="mt-1.5 p-1.5 bg-gray-50 rounded border border-gray-100 hover:border-gray-300 transition-colors w-fit">
                                <div className="flex items-center gap-1.5">
                                    <ComputerDesktop className="w-3 h-3 text-gray-400"/>
                                    <span className="font-mono text-[10px] text-gray-500 truncate max-w-[200px]" title={entry.txID}>
                                        Tx: {entry.txID.substring(0, 15)}...
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

interface OrderRow {
  id: string;
  display_id: string;
  created_at: string;
  history?: any[];
  seller_id?: string;
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

type SortKey = 'created_at';
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
  const [isShipping, setIsShipping] = useState<string | null>(null);
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
          // Chỉ sort theo created_at
          const timeA = new Date(a.created_at).getTime();
          const timeB = new Date(b.created_at).getTime();

          if (timeA < timeB) return sortDir === 'asc' ? -1 : 1;
          if (timeA > timeB) return sortDir === 'asc' ? 1 : -1;
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
      if (!status) return <span className="text-[10px] bg-gray-50 text-gray-400 px-2 py-0.5 border border-gray-200 uppercase font-medium">Syncing...</span>;

      const s = status.toUpperCase();
      let styleClass = "bg-gray-50 text-gray-500 border-gray-200"; // Default

      if (['DELIVERED', 'SETTLED', 'RETURNED'].includes(s)) {
          styleClass = "bg-gray-900 text-white border-gray-900"; // Completed (Dark)
      } else if (['RETURN_REQUESTED', 'RETURN_IN_TRANSIT', 'CANCELLED', 'COD_PENDING'].includes(s)) {
          styleClass = "bg-gray-100 text-gray-900 border-gray-300 font-bold"; // Alert
      } else if (['PAID', 'SHIPPED', 'CREATED'].includes(s)) {
          styleClass = "bg-white text-gray-900 border-gray-300 font-medium"; // Active
      }

      return (
          <span className={`text-[10px] px-2 py-0.5 border ${styleClass} uppercase tracking-wide font-medium`}>
              {status.replace(/_/g, " ")}
          </span>
      );
  }


  // --- 1. HÀM KIỂM TRA ROLE ---
  const checkUserRole = async (token: string) => {
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
              console.warn("Token invalid");
              localStorage.removeItem("medusa_token");
              setIsLoggedIn(false); setIsAuthorized(false);
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
        if (!confirm("Confirm that the order has been successfully picked up from the seller and shipping has started?")) return;
      
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
                alert("Error: " + (result.error || "Failed"));
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
                created_at: order.created_at,
                history: order.history || [], 
                seller_id: order.seller_id, 
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
                        sellerCompanyID: data.sellerCompanyID,
                        updatedAt: data.updatedAt 
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
        // Default sort by created_at DESC
        const sortedOrders = loadedOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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

    if (isCheckingRole) return <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mb-4"></div><p className="text-gray-600 font-medium">Authenticating...</p></div>

  if (isLoggedIn && !isAuthorized) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 font-sans">
            <div className="bg-white p-8 rounded-lg shadow-sm text-center max-w-md border border-gray-200">
                <h1 className="text-xl font-bold text-gray-900 mb-2 uppercase">Access Denied</h1>
                <p className="text-gray-500 mb-6 text-sm">
                    This account does not have access to the <b>SHIPPER</b> portal.
                    <br/>Please contact Admin.
                </p>
                <button onClick={handleLogout} className="bg-black text-white px-6 py-2 rounded-md hover:bg-gray-800 font-medium transition text-sm uppercase">
                    Logout
                </button>
            </div>
          </div>
      )
  }

    if (!isLoggedIn) {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-sm border border-gray-200">
            <div className="text-center mb-8">
            <h2 className="text-xl font-bold mt-2 text-gray-900">
                Shipper Portal
            </h2>
            <p className="text-gray-500 text-sm">Login to manage deliveries</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
            <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-300 p-2.5 rounded-md text-sm focus:ring-0 focus:border-black outline-none transition"
                placeholder="shipper@myfabric.com"
                required
            />

            <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-300 p-2.5 rounded-md text-sm focus:ring-0 focus:border-black outline-none transition"
                placeholder="Password"
                required
            />
            {loginError && (<div className="text-red-600 text-xs">{loginError}</div>)}
            <button
                type="submit"
                disabled={isLoadingLogin}
                className="w-full bg-black text-white p-2.5 rounded-md hover:bg-gray-800 font-medium text-sm transition shadow-sm uppercase tracking-wide"
            >
                {isLoadingLogin ? "Logging in..." : "Login"}
            </button>
            </form>
            <div className="text-center mt-6">
            <p className="text-xs text-gray-500">
                Don't have an account? 
                <a href="http://localhost:8000/dk/shipper/register" className="ml-1 text-black font-bold hover:underline">
                Register
                </a>
            </p>
            </div>
        </div>
        </div>
    )
    }

    // 3. Dashboard Main UI
    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900 flex text-sm">

            {/* --- SIDEBAR MENU --- */}
            <aside className="w-64 bg-white border-r border-gray-200 h-screen sticky top-0 flex flex-col z-30">
                <div className="p-6 border-b border-gray-100">
                    <h1 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <div className="flex items-center gap-2 text-gray-900">
                            <Icons.Truck />
                            <span>Shipper</span>
                        </div>
                    </h1>
                    <p className="text-xs text-gray-500 mt-1 truncate font-mono" title={currentUser?.email}>{currentUser?.email}</p>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    <button onClick={() => setActiveTab('orders')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'orders' ? 'bg-gray-100 text-gray-900 font-bold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}>
                        <Icons.Box /> Orders
                    </button>
                    <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-gray-100 text-gray-900 font-bold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}>
                        <Icons.Settings /> Settings
                    </button>
                </nav>

                <div className="p-4 border-t border-gray-100">
                    <button onClick={handleLogout} className="w-full px-3 py-2 text-gray-500 hover:text-gray-900 rounded-md hover:bg-gray-50 text-xs font-medium transition flex items-center gap-2 uppercase tracking-wide">
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
                                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Order Management</h2>
                                <p className="text-sm text-gray-500 mt-1">Overview of assigned shipments</p>
                            </div>
                            <button onClick={() => loadShipperOrders()} className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-xs font-medium shadow-sm transition flex items-center gap-2 uppercase">
                                <span className={isLoadingData ? "animate-spin" : ""}>⟳</span> Refresh
                            </button>
                        </div>

                        {/* --- TOOLBAR (Filter, Sort, Search) --- */}
                        <div className="flex flex-wrap gap-4 mb-6 items-center justify-between bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                            <div className="flex gap-3 items-center flex-1 ml-2">
                                {/* Search */}
                                <div className="relative flex-1 max-w-md">
                                    <span className="absolute left-3 top-2.5 text-gray-400"><MagnifyingGlass /></span>
                                    <input
                                        placeholder="Search Order ID..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 text-sm border-none focus:ring-0 outline-none h-full bg-transparent placeholder-gray-400 text-gray-900"
                                    />
                                </div>
                                <div className="h-6 w-px bg-gray-200 mx-1"></div>
                                {/* Filter Status */}
                                <div className="flex items-center gap-2">
                                    <Funnel className="text-gray-400 w-4 h-4" />
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        className="border-none bg-transparent text-sm font-medium text-gray-600 cursor-pointer focus:ring-0 outline-none hover:text-gray-900 transition uppercase"
                                    >
                                        <option value="ALL">All Statuses</option>
                                        <option value="CREATED">Created</option>
                                        <option value="PAID">Paid</option>
                                        <option value="SHIPPED">Shipped</option>
                                        <option value="DELIVERED">Delivered</option>
                                        <option value="RETURN_REQUESTED">Return Requested</option>
                                        <option value="RETURN_IN_TRANSIT">Return In Transit</option>
                                        <option value="RETURNED">Returned</option>
                                        <option value="DELIVERED_COD_PENDING">Delivered (COD Pending)</option>
                                        <option value="COD_REMITTED">COD Remitted</option>
                                        <option value="SETTLED">Settled</option>
                                        <option value="CANCELLED">Cancelled</option>
                                    </select>
                                </div>
                            </div>

                            {/* Sort */}
                            <div className="relative mr-2" ref={sortMenuRef}>
                                <button
                                    onClick={() => setShowSortMenu(!showSortMenu)}
                                    className="flex items-center justify-center px-3 py-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md text-sm font-medium gap-1 transition uppercase"
                                >
                                    Sort <Icons.Sort />
                                </button>
                                {showSortMenu && (
                                    <div className="absolute top-full right-0 mt-2 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1 animate-in fade-in zoom-in duration-100 overflow-hidden">
                                        <div className="px-3 py-2 text-[10px] text-gray-400 font-bold uppercase border-b border-gray-100">Sort By</div>
                                        <div onClick={() => { setSortKey('created_at'); setShowSortMenu(false); }} className={`px-4 py-2 text-xs cursor-pointer hover:bg-gray-50 flex justify-between ${sortKey === 'created_at' ? 'text-black font-bold' : 'text-gray-600'}`}>Created Date {sortKey === 'created_at' && <Icons.Check />}</div>
                                        <div className="h-px bg-gray-100 my-1"></div>
                                        <div onClick={() => { setSortDir('desc'); setShowSortMenu(false); }} className={`px-4 py-2 text-xs cursor-pointer hover:bg-gray-50 flex justify-between ${sortDir === 'desc' ? 'text-black font-bold' : 'text-gray-600'}`}>Newest {sortDir === 'desc' && <Icons.Check />}</div>
                                        <div onClick={() => { setSortDir('asc'); setShowSortMenu(false); }} className={`px-4 py-2 text-xs cursor-pointer hover:bg-gray-50 flex justify-between ${sortDir === 'asc' ? 'text-black font-bold' : 'text-gray-600'}`}>Oldest {sortDir === 'asc' && <Icons.Check />}</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Table */}
                        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        <th className="px-6 py-4">Order ID</th>
                                        <th className="px-6 py-4">Created Date</th>
                                        <th className="px-6 py-4">Customer</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Fee / COD</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {processedOrders.length === 0 && !isLoadingData ? (
                                        <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic text-xs">No orders found.</td></tr>
                                    ) : (
                                        processedOrders.map((order) => (
                                            <tr key={order.id} onClick={() => setSelectedOrder(order)} className="hover:bg-gray-50 cursor-pointer transition-colors group">
                                                <td className="px-6 py-4 text-xs font-bold text-black font-mono">{order.display_id}</td>
                                                <td className="px-6 py-4 text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString('en-GB')}</td>
                                                <td className="px-6 py-4 text-xs text-gray-900">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{order.decryptedData?.customerName || "Hidden"}</span>
                                                        <span className="text-[10px] text-gray-400">{order.decryptedData?.shipping_phone}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">{order.decryptedData ? getBlockchainStatusBadge(order.decryptedData.status) : <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-400">Syncing...</span>}</td>
                                                <td className="px-6 py-4 text-xs text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="font-bold text-gray-900">{order.decryptedData ? formatPrice(order.decryptedData.shipping_fee, order.publicData.currency_code) : "-"}</span>
                                                        {order.decryptedData?.paymentMethod === 'COD' && (
                                                            <span className="text-[9px] text-gray-500 bg-gray-100 px-1 rounded border border-gray-200 mt-1">COD: {formatPrice(order.decryptedData.cod_amount, order.publicData.currency_code)}</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                            {/* Pagination Placeholder */}
                            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-[10px] text-gray-500 uppercase font-bold">
                                <span>Total: {processedOrders.length} orders</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB SETTINGS */}
                {activeTab === 'settings' && (
                    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* Header Section */}
                        <div className="mb-8">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-3 bg-gradient-to-br from-gray-900 to-gray-700 rounded-xl shadow-lg">
                                    <Icons.Settings />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Carrier Configuration</h2>
                                    <p className="text-sm text-gray-500 mt-0.5">Manage your shipping profile and preferences</p>
                                </div>
                            </div>
                        </div>

                        {/* Main Settings Card */}
                        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                            {/* Account Info Banner */}
                            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-8 py-6 border-b border-gray-200">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-4">
                                        <div className="w-16 h-16 bg-gradient-to-br from-gray-900 to-gray-700 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                                            {settingsForm.carrier_name?.charAt(0).toUpperCase() || <User className="w-8 h-8" />}
                                        </div>
                                <div>
                                            <h3 className="text-lg font-bold text-gray-900">{settingsForm.carrier_name || "Carrier Name"}</h3>
                                            <p className="text-sm text-gray-600 font-mono mt-0.5">{settingsForm.email}</p>
                                            <div className="flex gap-2 mt-2">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-300 rounded-full text-xs font-medium text-gray-700">
                                                    <CheckCircle className="w-3 h-3 text-green-600" />
                                                    Active Carrier
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-gray-500 uppercase tracking-wide font-bold mb-1">Base Fee</p>
                                        <p className="text-2xl font-bold text-gray-900">${settingsForm.shipping_fee}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Form Section */}
                            <form onSubmit={handleSaveSettings} className="p-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                    {/* Carrier Name */}
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                                                <Icons.Truck />
                                            </div>
                                            Carrier Name
                                        </label>
                                    <input
                                        type="text"
                                        value={settingsForm.carrier_name}
                                        onChange={(e) => setSettingsForm({ ...settingsForm, carrier_name: e.target.value })}
                                            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-sm font-medium focus:border-gray-900 focus:ring-0 outline-none transition-all bg-gray-50 focus:bg-white"
                                            placeholder="e.g., FastExpress Logistics"
                                    />
                                        <p className="text-xs text-gray-500 mt-2 ml-1">Your official carrier/company name</p>
                                </div>

                                    {/* Contact Phone */}
                                <div>
                                        <label className="block text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                </svg>
                                            </div>
                                            Contact Phone
                                        </label>
                                    <input
                                        type="text"
                                        value={settingsForm.phone}
                                        onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })}
                                            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-sm font-medium focus:border-gray-900 focus:ring-0 outline-none transition-all bg-gray-50 focus:bg-white"
                                            placeholder="+1 (555) 000-0000"
                                    />
                                        <p className="text-xs text-gray-500 mt-2 ml-1">Customer support hotline</p>
                                </div>

                                    {/* Email (Read-only) */}
                                <div>
                                        <label className="block text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                </svg>
                                        </div>
                                            Email Address
                                            <span className="ml-auto text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-medium">Read-only</span>
                                        </label>
                                        <input
                                            type="email"
                                            value={settingsForm.email}
                                            disabled
                                            className="w-full border-2 border-gray-200 bg-gray-100 rounded-xl px-4 py-3.5 text-sm font-medium text-gray-500 cursor-not-allowed"
                                        />
                                        <p className="text-xs text-gray-500 mt-2 ml-1">Account email (cannot be changed)</p>
                                    </div>

                                    {/* Shipping Fee */}
                                    <div className="md:col-span-2 bg-gradient-to-br from-gray-50 to-white border-2 border-gray-200 rounded-xl p-6">
                                        <label className="block text-sm font-semibold text-gray-800 mb-3">
                                            Base Shipping Fee
                                        </label>
                                        <div className="flex items-center gap-4">
                                            <div className="relative flex-1 max-w-xs">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500">
                                                    <span className="text-lg font-bold">$</span>
                                </div>
                                    <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={settingsForm.shipping_fee}
                                                    onChange={(e) => setSettingsForm({ ...settingsForm, shipping_fee: parseFloat(e.target.value) || 0 })}
                                                    className="w-full border-2 border-gray-300 rounded-xl pl-10 pr-4 py-4 text-lg font-bold focus:border-green-500 focus:ring-0 outline-none transition-all bg-white"
                                                    placeholder="10.00"
                                                />
                                            </div>
                                            <div className="flex-1 bg-white rounded-lg p-4 border border-gray-200">
                                                <p className="text-xs text-gray-600 leading-relaxed">
                                                    <strong className="text-gray-900">Standard rate</strong> applied to all shipments. This is your default base fee before any additional charges or discounts.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="pt-6 border-t-2 border-gray-100 flex items-center justify-between">
                                    <p className="text-xs text-gray-500 max-w-md">
                                        Changes will be applied immediately and affect all future orders assigned to your carrier.
                                    </p>
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setSettingsForm({
                                                carrier_name: currentUser?.metadata?.carrier_name || "",
                                                phone: currentUser?.metadata?.phone || "",
                                                email: currentUser?.email || "",
                                                shipping_fee: currentUser?.metadata?.shipping_fee ? parseFloat(currentUser.metadata.shipping_fee) : 10
                                            })}
                                            className="px-6 py-3 bg-white border-2 border-gray-200 text-gray-700 font-semibold rounded-xl transition-all text-sm shadow-sm"
                                        >
                                            Reset
                                        </button>
                                    <button
                                        type="submit"
                                        disabled={isSavingSettings}
                                            className="px-8 py-3 bg-gradient-to-r from-gray-900 to-gray-700 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed text-sm flex items-center gap-2"
                                    >
                                            {isSavingSettings ? (
                                                <>
                                                    <Spinner className="animate-spin w-5 h-5" />
                                                    <span>Saving Changes...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle className="w-5 h-5" />
                                                    <span>Save Changes</span>
                                                </>
                                            )}
                                    </button>
                                    </div>
                                </div>
                            </form>
                        </div>

                        {/* Info Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-900 text-sm mb-1">Profile Visibility</h4>
                                        <p className="text-xs text-gray-600 leading-relaxed">Your carrier information is visible to customers during checkout.</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-900 text-sm mb-1">Automatic Updates</h4>
                                        <p className="text-xs text-gray-600 leading-relaxed">Settings sync instantly across all active shipments and orders.</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-900 text-sm mb-1">Secure Data</h4>
                                        <p className="text-xs text-gray-600 leading-relaxed">All changes are encrypted and stored securely on the blockchain.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </main>

            {/* Modal Chi Tiết (Monochrome) */}
            {selectedOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity" onClick={() => setSelectedOrder(null)}></div>
                    <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200 z-50 border border-gray-200 overflow-hidden">
                        {/* Header */}
                        <div className="bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 z-10 shrink-0">
                            <div>
                                <h3 className="font-bold text-lg text-gray-900">Order {selectedOrder.display_id}</h3>
                                <p className="text-[10px] text-gray-500 mt-1 font-mono uppercase">{selectedOrder.created_at}</p>
                            </div>
                            <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-black transition p-1 rounded-md hover:bg-gray-100"><XMark /></button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            {/* Customer */}
                            <div className="mb-6 p-4 bg-gray-50 rounded-md border border-gray-200">
                                <p className="text-xs font-bold text-gray-500 uppercase mb-2">Customer</p>
                                <p className="text-sm font-medium text-gray-900">{selectedOrder.decryptedData?.customerName}</p>
                                {/* Display Phone Number */}
                                    {selectedOrder.decryptedData?.shipping_phone && (
                                        <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-gray-300 text-gray-600 block w-fit mt-1">
                                            {selectedOrder.decryptedData.shipping_phone}
                                        </span>
                                    )}
                                <p className="text-xs text-gray-600 mt-2">{selectedOrder.decryptedData?.shipping_address}</p>
                            </div>

                            {/* Totals */}
                            <div className="border-t border-dashed border-gray-200 pt-4 space-y-2 text-sm">
                                <div className="flex justify-between text-gray-500">
                                    <span>Shipping Fee</span>
                                    <span>{formatPrice(selectedOrder.decryptedData?.shipping_fee, selectedOrder.publicData.currency_code)}</span>
                                </div>
                                <div className="flex justify-between text-gray-500">
                                    <span>COD Amount</span>
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
                            
                            {/* 🔥 4. CHÈN AUDIT TRAIL VÀO ĐÂY 🔥 */}
                            <div className="border-t-2 border-gray-100 pt-6 pb-4 mt-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Audit Trail</h3>
                                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded border border-gray-200">Immutable</span>
                                </div>
                                {/* Truyền sellerId từ selectedOrder.seller_id (đã map từ API) */}
                                <AuditTrail 
                                    history={selectedOrder.history || []} 
                                    sellerId={selectedOrder.seller_id} 
                                />
                            </div>

                            {/* Actions */}
                            <div className="mt-6 pt-6 border-t border-gray-200 flex flex-col gap-3">
                                {/* LOGIC XÁC NHẬN GIAO HÀNG */}

                                {/* BUTTON 1: SHIP ORDER (Lấy hàng từ Seller) */}
                                {((selectedOrder.decryptedData?.paymentMethod === 'COD' && selectedOrder.decryptedData.status === 'CREATED') ||
                                  (selectedOrder.decryptedData?.paymentMethod === 'PREPAID' && selectedOrder.decryptedData.status === 'PAID')) && (
                                    <button 
                                        onClick={() => handleShipOrder(selectedOrder.id)} 
                                        disabled={isShipping === selectedOrder.id} 
                                        className="w-full bg-black hover:bg-gray-800 text-white py-2.5 rounded-md font-bold shadow-sm transition flex justify-center items-center gap-2 text-xs uppercase tracking-wide"
                                    >
                                        {isShipping === selectedOrder.id ? (
                                            <Spinner className="animate-spin" />
                                        ) : (
                                            <><Icons.Truck/> Confirm Pickup</>
                                        )}
                                    </button>
                                )}

                                {/* BUTTON 2: GIAO HÀNG THÀNH CÔNG (PREPAID) */}
                                {selectedOrder.decryptedData?.paymentMethod === 'PREPAID' && selectedOrder.decryptedData.status === 'SHIPPED' && (
                                    <button onClick={() => handleConfirmDelivery(selectedOrder.id, false)} disabled={isDelivering === selectedOrder.id} className="w-full bg-black hover:bg-gray-800 text-white py-2.5 rounded-md font-bold shadow-sm transition flex justify-center items-center gap-2 text-xs uppercase tracking-wide">
                                        {isDelivering === selectedOrder.id ? <Spinner className="animate-spin" /> : <><Icons.Truck/> Confirm Delivery</>}
                                    </button>
                                )}
                                
                                {/* BUTTON 3: GIAO HÀNG & THU TIỀN (COD) */}
                                {selectedOrder.decryptedData?.paymentMethod === 'COD' && selectedOrder.decryptedData.status === 'SHIPPED' && (
                                    <button onClick={() => handleConfirmDelivery(selectedOrder.id, true)} disabled={isDelivering === selectedOrder.id} className="w-full bg-black hover:bg-gray-800 text-white py-2.5 rounded-md font-bold shadow-sm transition flex justify-center items-center gap-2 text-xs uppercase tracking-wide">
                                        {isDelivering === selectedOrder.id ? <Spinner className="animate-spin" /> : <><CurrencyDollar/> Confirm Delivery & Collect COD</>}
                                    </button>
                                )}

                                {/* --- 4. LẤY HÀNG HOÀN TRẢ (SHIP RETURN) --- */}
                                {/* Hiển thị khi Khách đã yêu cầu trả hàng (RETURN_REQUESTED) */}
                                {selectedOrder.decryptedData?.status === 'RETURN_REQUESTED' && (
                                    <button 
                                        onClick={() => handleShipReturn(selectedOrder.id)} 
                                        disabled={isReturning === selectedOrder.id} 
                                        className="w-full bg-black hover:bg-gray-800 text-white py-2.5 rounded-md font-bold shadow-sm transition flex justify-center items-center gap-2 text-xs uppercase tracking-wide"
                                    >
                                        {isReturning === selectedOrder.id ? (
                                            <Spinner className="animate-spin" />
                                        ) : (
                                            <><Icons.Truck/> Confirm Return Pickup</>
                                        )}
                                    </button>
                                )}
                                
                                {/* Trạng thái đang hoàn trả (chỉ hiển thị thông báo) */}
                                {selectedOrder.decryptedData?.status === 'RETURN_IN_TRANSIT' && (
                                    <div className="p-3 bg-gray-100 text-gray-700 rounded-md text-center text-xs font-bold border border-gray-300 uppercase">
                                        Return in transit to seller...
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