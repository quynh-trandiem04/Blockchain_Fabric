// src\app\[countryCode]\partner\page.tsx

"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
// Import Icons
import { 
    Photo, Tag, CurrencyDollar, ArchiveBox, XMark, CheckCircle, 
    ArrowRightOnRectangle, Spinner, MagnifyingGlass, Funnel,
    ShoppingBag, Tag as TagIcon, Plus, Trash, User, RocketLaunch
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
    medusa_status: string;
    medusa_payment: string;
    cod_status?: string; // Thêm trường này cho UI List
  };
  status: "Pending" | "Success" | "Error";
  decryptedData: {
      customerName: string;
      shipping_address: string;
      shipping_phone: string;
      items: any[];
      amount_untaxed: number;
      shipping_fee: number;
      cod_amount: number;
      status: string;       
      paymentMethod: string;
      codStatus?: string;
      updatedAt?: string; 
  } | null; 
  error?: string;
}

type SortKey = 'display_id' | 'created_at' | 'updated_at';
type SortDirection = 'asc' | 'desc';

export default function SellerDashboard() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const router = useRouter()
  const params = useParams()
  
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isCheckingRole, setIsCheckingRole] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false) 
  const [loginError, setLoginError] = useState("")
  const [isLoadingLogin, setIsLoadingLogin] = useState(false)

  const [activeTab, setActiveTab] = useState<'orders' | 'products'>('orders');
  
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [isLoadingOrders, setIsLoadingOrders] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [isShipping, setIsShipping] = useState<string | null>(null); 
  const [isConfirmingReturn, setIsConfirmingReturn] = useState<string | null>(null); 

  const [products, setProducts] = useState<any[]>([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  
  const [newProduct, setNewProduct] = useState({ 
      title: "", subtitle: "", handle: "", description: "", price: 0, inventory_quantity: 10, image_url: "" 
  });
  
  const [optionName, setOptionName] = useState("");
  const [optionValues, setOptionValues] = useState("");
  const [prodOptions, setProdOptions] = useState<{title: string, values: string[]}[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatPrice = (amount: number | undefined, currency: string | undefined) => {
    if (amount === undefined || amount === null) return "0";
    const code = (currency || "USD").toUpperCase();
    try {
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: code }).format(amount); 
    } catch (e) { return `${amount} ${code}`; }
  }

  const getBlockchainStatusBadge = (status: string) => {
      const colorMap: Record<string, string> = {
          CREATED: "bg-gray-100 text-gray-700 border-gray-200",
          PAID: "bg-blue-50 text-blue-700 border-blue-200",
          SHIPPED: "bg-indigo-50 text-indigo-700 border-indigo-200",
          DELIVERED: "bg-green-50 text-green-700 border-green-200",
          DELIVERED_COD_PENDING: "bg-orange-50 text-orange-700 border-orange-200",
          COD_REMITTED: "bg-green-50 text-green-700 border-green-200",
          SETTLED: "bg-purple-50 text-purple-700 border-purple-200",
          CANCELLED: "bg-red-50 text-red-700 border-red-200",
          RETURN_REQUESTED: "bg-yellow-50 text-yellow-700 border-yellow-200",
          RETURN_IN_TRANSIT: "bg-amber-50 text-amber-700 border-amber-200",
          RETURNED: "bg-pink-50 text-pink-700 border-pink-200"
      };

      if (!status) return <span className="text-xs bg-gray-50 text-gray-400 px-2 py-1 rounded border border-gray-200">Syncing...</span>;

      return (
          <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${colorMap[status] || "bg-gray-100"} uppercase tracking-wide`}>
              {status.replace(/_/g, " ")}
          </span>
      );
  }

  const getPaymentMethodBadge = (method: string) => {
      if (method === 'COD') return <span className="text-[10px] font-bold px-2 py-1 rounded bg-orange-50 text-orange-700 border border-orange-200">COD</span>;
      if (method === 'PREPAID') return <span className="text-[10px] font-bold px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200">PREPAID</span>;
      return <span className="text-[10px] text-gray-400">{method}</span>;
  }

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
              aVal = parseInt(a.display_id.replace('#', ''));
              bVal = parseInt(b.display_id.replace('#', ''));
          } else if (sortKey === 'updated_at') {
              const timeA = a.decryptedData?.updatedAt ? new Date(a.decryptedData.updatedAt).getTime() : new Date(a.created_at).getTime();
              const timeB = b.decryptedData?.updatedAt ? new Date(b.decryptedData.updatedAt).getTime() : new Date(b.created_at).getTime();
              aVal = timeA; bVal = timeB;
          } else {
              aVal = new Date(a.created_at).getTime();
              bVal = new Date(b.created_at).getTime();
          }
          if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
          return 0;
      });
  }, [orders, searchQuery, statusFilter, paymentFilter, sortKey, sortDir]);

  // --- ACTIONS ---
  const checkUserRole = async (token: string) => {
      console.log("🔍 Checking Role...");
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
          
          // Nếu Token lỗi (User khách hoặc hết hạn) -> Redirect về trang mua hàng
          if (!res.ok) {
              console.warn("Auth failed or token expired");
              localStorage.removeItem("medusa_token");
              setIsAuthorized(false);
              setIsLoggedIn(false); 
              return;
          }

          const { user } = await res.json()
          const role = user.metadata?.fabric_role;
          const status = user.metadata?.approver_status;

          if (role !== 'sellerorgmsp') {
              alert("This account is not authorized as a Seller.");
              setIsAuthorized(false);
          } else if (status === 'pending') {
              alert("This account is still pending approval.");
              setIsAuthorized(false);
          } else if (status === 'rejected') {
              alert("This account has been rejected.");
              setIsAuthorized(false);
          } else {
              setIsAuthorized(true)
              loadData(token)
          }
      } catch (e) {
          console.error("Connection error:", e);
          setIsAuthorized(false)
      } finally {
          setIsCheckingRole(false) 
      }
  }

  const loadData = (token: string) => {
      loadSellerOrders(token);
      loadSellerProducts(token);
  }

  const loadSellerOrders = async (tokenOverride?: string) => {
    console.log("loadSellerOrders...")
    setIsLoadingOrders(true)
    const token = tokenOverride || localStorage.getItem("medusa_token")
    if (!token) return

    const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

    try {
        // GỌI API LIST MỚI TỪ BLOCKCHAIN
        const res = await fetch(`${BACKEND_URL}/store/fabric/orders/list`, {
            headers: { 
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
                "x-publishable-api-key": publishableKey
            }
        })
        
        if (res.ok) {
            const { orders: rawOrders } = await res.json()
            
            console.log(`[Frontend Debug] Orders received count (Fabric): ${rawOrders.length}`);
            
            const mappedOrders: OrderRow[] = []
            console.log(`[Frontend Debug] Orders received count: ${rawOrders.length}`);

            await Promise.all(
              rawOrders.map(async (order: any) => {
                const row: OrderRow = {
                    id: order.id,
                    display_id: `#${order.display_id}`,
                    created_at: new Date(order.created_at).toLocaleDateString('vi-VN'),
                    publicData: {
                        email: order.publicData.email || "Loading...",
                        total: order.publicData.total || 0,
                        currency_code: order.publicData.currency_code || "USD",
                        medusa_status: order.publicData.medusa_status,
                        medusa_payment: order.publicData.medusa_payment,
                        cod_status: order.publicData.cod_status
                    },
                    status: "Pending",
                    decryptedData: null
                }
                
                try {
                  const resDecrypt = await fetch(`${BACKEND_URL}/store/fabric/orders/${order.id}/decrypt/seller`, { 
                    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "x-publishable-api-key": publishableKey }
                })   
               if (resDecrypt.ok) {
                    const data = await resDecrypt.json();
                    row.status = "Success";
                    row.decryptedData = data;

                    if (data) {
                        row.publicData.email = data.customerName || row.publicData.email;
                        row.publicData.total = data.amount_total || data.amount_untaxed || 0;
                        
                        // Update status cho chính xác nhất
                        if (data.status) {
                            row.publicData.medusa_status = data.status;
                            if (row.decryptedData) row.decryptedData.status = data.status;
                        }

                        // Cập nhật Payment sau khi decrypt nếu có
                        if (data.paymentMethod) {
                            row.publicData.medusa_payment = data.paymentMethod;
                        }
                    }
                  } else {
                        const errorData = await resDecrypt.json();
                        console.warn(`[Frontend] ❌ Decrypt FAILED for ${order.id}. Status: ${resDecrypt.status}. Error: ${errorData.error || 'Unknown'}`);
                    row.status = "Error"
                    row.error = errorData.error || "Syncing...";
                  }
                } catch (e) { 
                    console.error(`[Frontend] ❌ Network Error during Decrypt for ${order.id}`, e);
                    row.status = "Error" 
                }
                mappedOrders.push(row)
              })
            )
            const sorted = mappedOrders.sort((a, b) => b.id.localeCompare(a.id));
            setOrders(sorted);
            
            if (selectedOrder) {
                const updated = sorted.find(o => o.id === selectedOrder.id);
                if (updated) setSelectedOrder(updated);
            }
        }
    } catch (err) {} finally { setIsLoadingOrders(false) }
  }

  const loadSellerProducts = async (tokenOverride?: string) => {
    setIsLoadingProducts(true)
    const token = tokenOverride || localStorage.getItem("medusa_token")
    if (!token) return
    const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

    try {
        const res = await fetch(`${BACKEND_URL}/store/market/products/list`, {
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "x-publishable-api-key": publishableKey }
        })
        if (res.ok) {
            const { products } = await res.json()
            setProducts(products || []);
        }
    } catch (err) {} finally { setIsLoadingProducts(false) }
  }

  const handleAddOption = () => {
    if(!optionName || !optionValues) return;
    const valuesArray = optionValues.split(",").map(v => v.trim()).filter(v => v);
    setProdOptions([...prodOptions, { title: optionName, values: valuesArray }]);
    setOptionName(""); setOptionValues("");
  }

  const handleRemoveOption = (index: number) => {
      const newOpts = [...prodOptions];
      newOpts.splice(index, 1);
      setProdOptions(newOpts);
  }

  const handleCreateProduct = async () => {
      if (!newProduct.title || !newProduct.price) { 
          alert("Please provide at least a title and price for the product."); 
          return; 
      }
      setIsCreatingProduct(true);
      const token = localStorage.getItem("medusa_token");
      const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

      try {
          let variantsPayload: any[] = [];

          if (prodOptions.length > 0) {
              let combinations: any[] = [];
              if (prodOptions.length === 1) {
                  combinations = prodOptions[0].values.map(v => [{ title: prodOptions[0].title, value: v }]);
              } else {
                  // Helper đệ quy đơn giản cho n chiều
                  const cartesian = (args: any[]) => {
                    const r: any[] = [], max = args.length - 1;
                    function helper(arr: any[], i: number) {
                        for (let j = 0, l = args[i].length; j < l; j++) {
                            const a = arr.slice(0); // clone
                            a.push(args[i][j]);
                            if (i === max) r.push(a);
                            else helper(a, i + 1);
                        }
                    }
                    helper([], 0);
                    return r;
                  };
                  
                  const args = prodOptions.map(opt => opt.values.map(v => ({ title: opt.title, value: v })));
                  combinations = cartesian(args);
              }

              variantsPayload = combinations.map((combo: any[]) => {
                  const title = combo.map(c => c.value).join(" / ");
                  const optionsMap: Record<string, string> = {};
                  combo.forEach(c => {
                      optionsMap[c.title] = c.value;
                  });

                  return {
                      title: title,
                      options: optionsMap
                  };
              });

          } else {
              variantsPayload = [];
          }

          const payload = {
              ...newProduct,
              images: newProduct.image_url ? [{ url: newProduct.image_url }] : [],
              options: prodOptions,
              variants: variantsPayload
          };

          const res = await fetch(`${BACKEND_URL}/store/market/products`, {
              method: "POST",
              headers: { 
                  "Authorization": `Bearer ${token}`, 
                  "Content-Type": "application/json", 
                  "x-publishable-api-key": publishableKey 
              },
              body: JSON.stringify(payload)
          });
          
          if (res.ok) {
              alert("Product created successfully!");
              setShowCreateModal(false); 
              loadSellerProducts(token || "");
              setNewProduct({ title: "", subtitle: "", handle: "", description: "", price: 0, inventory_quantity: 10, image_url: "" });
              setProdOptions([]);
          } else {
              const err = await res.json();
              alert("Error: " + (err.error || err.message));
          }
      } catch (e) { 
          console.error(e);
          alert("Error connecting to server"); 
      } finally { 
          setIsCreatingProduct(false); 
      }
  }

    const handleConfirmReturn = async (orderId: string) => {
      if(!confirm("Confirm that you have received the returned item from the Shipper?")) return;
      
      setIsConfirmingReturn(orderId);
      const token = localStorage.getItem("medusa_token");
      const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

      try {
          const res = await fetch(`${BACKEND_URL}/store/fabric/orders/${orderId}/confirm-return`, {
              method: "POST",
              headers: { 
                  "Content-Type": "application/json", 
                  "Authorization": `Bearer ${token}`,
                  "x-publishable-api-key": publishableKey
              }
          });
          
          const result = await res.json();

          if (res.ok) {
              alert("Success! Return confirmed.");
              loadSellerOrders(token || "");
              if (selectedOrder?.id === orderId) setSelectedOrder(null); // Đóng modal
          } else {
              alert("Error: " + (result.message || "Failed"));
          }
      } catch (err) {
          alert("Error connecting to server");
      } finally { 
          setIsConfirmingReturn(null); 
      }
  }

  // --- AUTH FLOW ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoginError(""); setIsLoadingLogin(true);
    try {
      const res = await fetch(`${BACKEND_URL}/auth/user/emailpass`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (res.ok && data.token) {
        localStorage.setItem("medusa_token", data.token)
        setIsLoggedIn(true)
        await checkUserRole(data.token);
      } else { setLoginError("Email or password is incorrect."); }
    } catch (err) { setLoginError("Error connecting to server."); } 
    finally { setIsLoadingLogin(false); } 
  }

  const handleLogout = () => { localStorage.removeItem("medusa_token"); window.location.reload(); }

  useEffect(() => {
    const token = localStorage.getItem("medusa_token")
    if (token) { setIsLoggedIn(true); checkUserRole(token); } 
    else { setIsCheckingRole(false); setIsLoggedIn(false); }
  }, [])

  // ================= UI RENDERING =================

  if (isCheckingRole) return <div className="h-screen flex flex-col items-center justify-center gap-2"><Spinner className="animate-spin text-blue-600 w-8 h-8" /><span className="text-gray-500 text-sm">Đang tải...</span></div>
  
  if (!isLoggedIn || !isAuthorized) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
           <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg border border-gray-100">
             <div className="text-center mb-8">
                <div className="w-12 h-12 bg-blue-600 rounded-lg text-white font-bold text-xl flex items-center justify-center mx-auto mb-4">S</div>
                <h2 className="text-2xl font-bold text-gray-900">Seller Portal</h2>
                <p className="text-gray-500 text-sm mt-1">Log in to manage your store</p>
             </div>
             {isLoggedIn && !isAuthorized && (
                 <div className="mb-6 p-4 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-center gap-2">
                     <XMark className="w-4 h-4"/> No access rights.
                 </div>
             )}
             <form onSubmit={handleLogin} className="space-y-5">
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="shop@example.com" required />
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="••••••••" required />
               </div>
               {loginError && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100">{loginError}</div>}
               <button type="submit" disabled={isLoadingLogin} className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 font-bold transition shadow-md flex justify-center items-center">
                  {isLoadingLogin ? <Spinner className="animate-spin text-white w-5 h-5" /> : "Log in"}
               </button>
               {isLoggedIn && <button type="button" onClick={handleLogout} className="w-full text-center text-gray-500 text-sm hover:text-gray-900 mt-2">Log out</button>}
             </form>
           </div>
        </div>
      )

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans text-gray-900">
      
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full z-20">
          <div className="p-6 border-b border-gray-100 flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg text-white flex items-center justify-center font-bold text-lg shadow-sm">S</div>
              <div>
                  <h1 className="text-sm font-bold text-gray-900 leading-tight">Seller Portal</h1>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Dashboard</p>
              </div>
          </div>
          <nav className="flex-1 p-4 space-y-2">
              <button onClick={() => setActiveTab('orders')} className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'orders' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                  <ShoppingBag className="w-5 h-5"/> Orders
              </button>
              <button onClick={() => setActiveTab('products')} className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'products' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                  <TagIcon className="w-5 h-5"/> Products
              </button>
          </nav>
          <div className="p-4 border-t border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3 px-4 py-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500"><User/></div>
                  <div className="text-xs text-gray-500 truncate w-24">User Account</div>
              </div>
              <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition text-sm font-medium">
                  <ArrowRightOnRectangle /> Log out
              </button>
          </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 ml-64 p-8 bg-gray-50 min-h-screen">
        
        {/* TAB: ORDERS */}
        {activeTab === 'orders' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex justify-between items-end mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Orders</h1>
                        <p className="text-sm text-gray-500 mt-1">Manage and track orders from customers</p>
                    </div>
                    <button onClick={() => loadSellerOrders()} className="px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition">
                        <span className={isLoadingOrders ? "animate-spin" : ""}>⟳</span>
                    </button>
                </div>

                {/* Filters */}
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm mb-6 flex gap-3 items-center">
                    <div className="relative flex-1">
                        <span className="absolute left-3 top-2.5 text-gray-400"><MagnifyingGlass /></span>
                        <input placeholder="Search orders (ID, Email, Phone)..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm border-none focus:ring-0 outline-none h-full bg-transparent placeholder-gray-400 text-gray-900" />
                    </div>
                    <div className="w-px h-6 bg-gray-200"></div>
                    <div className="flex items-center gap-2 px-2">
                        <Funnel className="text-gray-400 w-4 h-4" />
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-sm border-none focus:ring-0 outline-none bg-transparent text-gray-700 cursor-pointer font-medium hover:text-blue-600 transition">
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
                    <div className="w-px h-6 bg-gray-200"></div>
                    <div className="relative" ref={sortMenuRef}>
                        <button onClick={() => setShowSortMenu(!showSortMenu)} className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg flex items-center gap-1 transition">
                            {sortDir === 'desc' ? 'Newest' : 'Oldest'} <Icons.Sort />
                        </button>
                        {showSortMenu && (
                            <div className="absolute right-0 top-full mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1 overflow-hidden animate-in fade-in zoom-in duration-100">
                                <button onClick={() => { setSortDir('desc'); setShowSortMenu(false); }} className="block w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition">Newest</button>
                                <button onClick={() => { setSortDir('asc'); setShowSortMenu(false); }} className="block w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition">Oldest</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-3 font-medium">Order ID</th>
                                <th className="px-6 py-3 font-medium">Created Date</th>
                                <th className="px-6 py-3 font-medium">Customer</th>
                                <th className="px-6 py-3 font-medium">Status</th>
                                <th className="px-6 py-3 font-medium text-right">Total Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {processedOrders.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-16 text-center text-gray-500 flex flex-col items-center justify-center gap-3">
                                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 text-xl">📭</div>
                                    <p>No orders found.</p>
                                </td></tr>
                            ) : processedOrders.map(order => (
                                <tr key={order.id} onClick={() => setSelectedOrder(order)} className="hover:bg-blue-50/50 cursor-pointer transition-colors group">
                                    <td className="px-6 py-4 font-medium text-blue-600 text-sm group-hover:text-blue-700">{order.display_id}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{order.created_at}</td>
                                    <td className="px-6 py-4 text-sm text-gray-900">
                                        <div className="flex flex-col">
                                            <span className="font-medium">{order.decryptedData?.customerName || "Guest"}</span>
                                            <span className="text-xs text-gray-400">{order.publicData.email}</span>
                                        </div>
                                    </td>
                                    {/* Cột Trạng thái & Thanh toán */}
                                    <td className="px-6 py-4">
                                        {/* HIỂN THỊ CẢ STATUS VÀ COD STATUS (UPDATE CHO PUBLIC DATA) */}
                                        <div className="flex flex-col gap-1 items-start">
                                            {getBlockchainStatusBadge(order.publicData.medusa_status)}

                                                <div className="flex gap-1">
                                                {getPaymentMethodBadge(order.publicData.medusa_payment)}

                                                {order.publicData.medusa_payment === 'COD' && (
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                                        order.publicData.cod_status === 'REMITTED' 
                                                                ? 'bg-green-100 text-green-700 border-green-200' 
                                                                : 'bg-gray-100 text-gray-500 border-gray-200'
                                                        }`}>
                                                        {order.publicData.cod_status || 'PENDING'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono text-sm font-medium text-gray-900">{order.decryptedData ? formatPrice(order.decryptedData.amount_untaxed, order.publicData.currency_code) : "-"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
                        <span> Showing {processedOrders?.length || 0} orders </span>
                    </div>
                </div>
            </div>
        )}

        {/* TAB: PRODUCTS */}
        {activeTab === 'products' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex justify-between items-end mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Products</h1>
                        <p className="text-sm text-gray-500 mt-1">List of products in the store</p>
                    </div>
                    <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 text-sm font-medium flex items-center gap-2 transition transform active:scale-95">
                        <Plus className="w-4 h-4"/> Create Product
                    </button>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-3 w-1/2">Product Information</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Stock</th>
                                <th className="px-6 py-3 text-right">Sale Price</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                             {products.length === 0 ? (
                                  <tr><td colSpan={4} className="px-6 py-16 text-center text-gray-500 flex flex-col items-center justify-center gap-3">
                                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 text-xl"><TagIcon /></div>
                                      <p>No products found.</p>
                                  </td></tr>
                              ) : products.map((p: any) => (
                                 <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                     <td className="px-6 py-4">
                                         <div className="flex items-center gap-4">
                                             <div className="w-12 h-12 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 overflow-hidden relative">
                                                 {p.thumbnail ? (
                                                    <img src={p.thumbnail} alt={p.title} className="w-full h-full object-cover"/>
                                                 ) : (
                                                    <Photo className="w-5 h-5"/>
                                                 )}
                                             </div>
                                             <div>
                                                 <div className="font-medium text-gray-900">{p.title}</div>
                                                 <div className="text-xs text-gray-500 font-mono mt-0.5">{p.handle}</div>
                                             </div>
                                         </div>
                                     </td>
                                     <td className="px-6 py-4">
                                         <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide ${p.status === 'published' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                             {p.status}
                                         </span>
                                     </td>
                                     <td className="px-6 py-4 text-sm text-gray-600 font-medium">
                                         {/* Hiển thị tồn kho từ metadata */}
                                         {p.display_inventory ?? 0} in stock
                                     </td>
                                     <td className="px-6 py-4 text-right font-medium text-gray-900">
                                         {/* Hiển thị giá từ metadata */}
                                         {p.display_price ? `$${p.display_price}` : "-"}
                                     </td>
                                 </tr>
                             ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
      </main>

      {/* --- MODAL TẠO SẢN PHẨM (ADVANCED UI) --- */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in duration-200">
                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50 sticky top-0 z-10">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Add new product</h2>
                        <p className="text-xs text-gray-500">Enter detailed information to list for sale</p>
                    </div>
                    <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-700 transition p-1 rounded-md hover:bg-gray-200"><XMark/></button>
                </div>
                
                <div className="p-8 space-y-6">
                    {/* General */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Product Name <span className="text-red-500">*</span></label>
                            <input className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" 
                                value={newProduct.title} onChange={e=>setNewProduct({...newProduct, title: e.target.value})} placeholder="VD: Áo Thun Basic"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Sale Price (USD) <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-gray-400"><CurrencyDollar /></span>
                                <input type="number" className="w-full border border-gray-300 pl-9 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" 
                                    value={newProduct.price} onChange={e=>setNewProduct({...newProduct, price: parseInt(e.target.value)})}/>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Handle (Optional)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-gray-400"><Tag /></span>
                                <input className="w-full border border-gray-300 pl-9 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition font-mono text-sm" 
                                    value={newProduct.handle} onChange={e=>setNewProduct({...newProduct, handle: e.target.value})} placeholder="ao-thun"/>
                            </div>
                        </div>
                    </div>

                    {/* Image */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Hình ảnh (URL)</label>
                        <div className="flex gap-3">
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-2.5 text-gray-400"><Photo /></span>
                                <input className="w-full border border-gray-300 pl-9 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" 
                                    value={newProduct.image_url} onChange={e=>setNewProduct({...newProduct, image_url: e.target.value})} placeholder="https://..."/>
                            </div>
                            {newProduct.image_url ? (
                                <img src={newProduct.image_url} alt="Preview" className="w-10 h-10 object-cover rounded-lg border border-gray-200 shadow-sm" />
                            ) : (
                                <div className="w-10 h-10 bg-gray-100 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xs">IMG</div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                         <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Product Description</label>
                            <textarea className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none transition" 
                                value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} placeholder="Details..."/>
                        </div>
                    </div>

                    <hr className="border-gray-100"/>

                    {/* Options & Variants */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2"><TagIcon className="w-4 h-4"/> Options</h3>
                        <div className="flex gap-2 mb-3">
                            <input className="border border-gray-300 p-2 rounded-lg text-sm w-1/3 outline-none focus:border-blue-500" placeholder="Name (VD: Size)" value={optionName} onChange={e=>setOptionName(e.target.value)} />
                            <input className="border border-gray-300 p-2 rounded-lg text-sm flex-1 outline-none focus:border-blue-500" placeholder="Values (VD: S, M, L)" value={optionValues} onChange={e=>setOptionValues(e.target.value)} />
                            <button onClick={handleAddOption} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100 transition shadow-sm">Add</button>
                        </div>
                        
                        {/* List Options */}
                        <div className="space-y-2">
                            {prodOptions.map((opt, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-white p-2.5 rounded-lg text-sm border border-gray-200 shadow-sm">
                                    <div className="flex gap-2">
                                        <span className="font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">{opt.title}</span>
                                        <span className="text-gray-600">{opt.values.join(", ")}</span>
                                    </div>
                                    <button onClick={() => handleRemoveOption(idx)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-md transition"><Trash className="w-4 h-4"/></button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Inventory */}
                    <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">Tồn kho tổng</label>
                         <div className="relative">
                            <span className="absolute left-3 top-2.5 text-gray-400"><ArchiveBox /></span>
                            <input className="w-full border border-gray-300 pl-9 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" type="number"
                                value={newProduct.inventory_quantity} onChange={e => setNewProduct({...newProduct, inventory_quantity: parseInt(e.target.value)})} />
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0">
                    <button onClick={() => setShowCreateModal(false)} className="px-5 py-2 text-gray-600 hover:bg-white border border-transparent hover:border-gray-200 rounded-lg transition font-medium">Cancel</button>
                    <button onClick={handleCreateProduct} disabled={isCreatingProduct} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-md flex items-center">
                        {isCreatingProduct ? <><Spinner className="animate-spin mr-2" /> Creating...</> : "Publish Now"}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* MODAL ORDER DETAIL (CLEAN UI) */}
      {selectedOrder && (
        // 1. Thêm onClick vào lớp phủ (backdrop) để bấm ra ngoài là đóng
        <div 
            className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedOrder(null)} 
        >
            {/* 2. Thêm onClick stopPropagation để bấm vào nội dung không bị đóng */}
            <div 
                className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col animate-in zoom-in duration-200"
                onClick={(e) => e.stopPropagation()} 
            >
                {/* HEADER - Sticky Top */}
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white rounded-t-xl z-10 shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Order {selectedOrder.display_id}</h2>
                        <p className="text-xs text-gray-500 mt-1 font-mono">{selectedOrder.created_at}</p>
                    </div>
                    <div className="flex items-center gap-3">
                         {/* Badge Status */}
                            <span className="px-2.5 py-1 bg-gray-100 rounded-full text-[10px] font-bold text-gray-600 border border-gray-200 uppercase tracking-wide">
                            {/* 🔥 ƯU TIÊN LẤY STATUS TỪ PUBLIC DATA 🔥 */}
                            {selectedOrder.publicData.medusa_status}
                            </span>
                    </div>
                </div>
                
                {/* BODY - Scrollable */}
                <div className="p-6 space-y-6 overflow-y-auto">
                    
                    {/* Customer Info */}
                    <div className="flex items-center gap-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-lg font-bold shrink-0">
                            {(selectedOrder.decryptedData?.customerName || "U").charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="font-bold text-gray-900 text-sm truncate">
                                {selectedOrder.decryptedData?.customerName || "Guest (Loading...)"}
                            </p>
                            <p className="text-xs text-gray-500 truncate mt-0.5">
                                {selectedOrder.decryptedData?.shipping_address || "..."}
                            </p>
                            <p className="text-xs text-blue-600 font-mono mt-0.5">
                                {selectedOrder.decryptedData?.shipping_phone}
                            </p>
                        </div>
                    </div>

                    {/* Products List */}
                    <div>
                        <h3 className="font-bold text-gray-800 text-xs uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Sản phẩm</h3>
                        <ul className="space-y-3">
                            {(selectedOrder.decryptedData?.items || []).length > 0 ? (
                                selectedOrder.decryptedData?.items.map((p: any, i: number) => (
                                    <li key={i} className="flex justify-between items-start text-sm">
                                    <div>
                                            <span className="text-gray-800 font-medium line-clamp-1">{p.title || p.product_name}</span>
                                            <span className="text-xs text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded inline-block mt-1">x{p.quantity}</span>
                                    </div>
                                        <span className="font-mono font-medium text-gray-900 whitespace-nowrap ml-4">
                                            {formatPrice(p.subtotal || (p.unit_price * p.quantity), selectedOrder.publicData.currency_code)}
                                    </span>
                                </li>
                                ))
                            ) : (
                                <li className="text-xs text-gray-400 italic text-center">Loading product details...</li>
                            )}
                        </ul>
                    </div>

                    {/* Financials */}
                    <div className="space-y-2 pt-4 border-t border-dashed border-gray-200">
                        <div className="flex justify-between text-xs text-gray-500">
                            <span>Subtotal</span>
                            <span>{formatPrice(selectedOrder.decryptedData?.amount_untaxed || selectedOrder.publicData.total, selectedOrder.publicData.currency_code)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                            <span>Shipping Fee</span>
                            <span>{formatPrice(selectedOrder.decryptedData?.shipping_fee, selectedOrder.publicData.currency_code)}</span>
                        </div>
                                                 <div className="flex justify-between text-base font-bold text-blue-700 pt-2 border-t border-gray-100 mt-2">
                            <span>Total</span>
                            <span>
                                {formatPrice(
                                    (selectedOrder.decryptedData?.amount_untaxed || selectedOrder.publicData.total) + 
                                    (selectedOrder.decryptedData?.shipping_fee || 0), 
                                    selectedOrder.publicData.currency_code
                                )}
                            </span>
                        </div>
                    </div>

                    {/* ACTIONS */}
                    <div className="pt-2">

                        {/* 🔥 1. NÚT XÁC NHẬN NHẬN HÀNG HOÀN (Seller Confirm Return) 🔥 */}
                        {/* Logic: Kiểm tra publicData.medusa_status là 'RETURN_IN_TRANSIT' */}
                        {selectedOrder.publicData.medusa_status === 'RETURN_IN_TRANSIT' && (
                            <button 
                                onClick={() => handleConfirmReturn(selectedOrder.id)} 
                                disabled={isConfirmingReturn === selectedOrder.id}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg transition text-sm flex justify-center gap-2 items-center transform active:scale-95 disabled:opacity-70 disabled:scale-100"
                            >
                                {isConfirmingReturn === selectedOrder.id ? (
                                    <><Spinner className="animate-spin" /> Processing...</>
                                ) : (
                                    <><CheckCircle/> CONFIRM RETURN RECEIVED</>
                                )}
                            </button>
                        )}
                        
                        {/* Thông báo chờ */}
                        {selectedOrder.publicData.medusa_status === 'RETURN_REQUESTED' && (
                             <div className="w-full py-3 bg-yellow-50 text-yellow-700 rounded-xl text-xs font-medium text-center border border-yellow-200">
                                Customer has requested a return. Awaiting Shipper pickup.
                             </div>
                        )}

                        {/* Thông báo hoàn tất */}
                        {selectedOrder.publicData.medusa_status === 'RETURNED' && (
                             <div className="w-full py-2.5 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold text-center border border-green-200 flex items-center justify-center gap-2">
                                <CheckCircle className="text-blue-600" /> Order has been successfully returned
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