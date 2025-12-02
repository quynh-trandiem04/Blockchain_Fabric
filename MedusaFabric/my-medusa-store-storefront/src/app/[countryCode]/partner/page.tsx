// src\app\[countryCode]\partner\page.tsx

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
    medusa_status: string;
    medusa_payment: string;

  };
  status: "Pending" | "Success" | "Error";
  decryptedData: {
      customerName: string;
      shipping_address: string;
      shipping_phone: string;
      product_lines: any[];
      amount_untaxed: number;
      shipping_fee: number;
      cod_amount: number;
      status: string;       
      paymentMethod: string;
      updatedAt?: string; 
  } | null; 
  error?: string;
}

type SortKey = 'display_id' | 'created_at' | 'updated_at';
type SortDirection = 'asc' | 'desc';

export default function SellerDashboard() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  // Khởi tạo Router và Params
  const router = useRouter()
  const params = useParams()
  const countryCode = params?.countryCode || "us"
  
  // State quản lý đăng nhập & quyền
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isCheckingRole, setIsCheckingRole] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false) 
  
  // State dữ liệu
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [isLoadingLogin, setIsLoadingLogin] = useState(false)
  const [loginError, setLoginError] = useState("")
  const [isShipping, setIsShipping] = useState<string | null>(null); 
  const [isConfirmingReturn, setIsConfirmingReturn] = useState<string | null>(null); 
  
  // State Modal
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);

  // State Filter & Sort
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- HELPERS ---
  const getBlockchainStatusBadge = (status: string) => {
      const styles: Record<string, string> = {
          // Trạng thái thường
          CREATED: "bg-gray-100 text-gray-700 border-gray-300",
          PAID: "bg-green-100 text-green-700 border-green-300",
          SHIPPED: "bg-blue-100 text-blue-700 border-blue-300",
          DELIVERED: "bg-teal-100 text-teal-700 border-teal-300",
          
          // Trạng thái COD
          DELIVERED_COD_PENDING: "bg-orange-100 text-orange-700 border-orange-300",
          COD_REMITTED: "bg-indigo-100 text-indigo-700 border-indigo-300",
          SETTLED: "bg-purple-100 text-purple-700 border-purple-300",
          
          // Exception
          CANCELLED: "bg-red-100 text-red-700 border-red-300",
          RETURN_REQUESTED: "bg-red-50 text-red-600 border-red-200",
          RETURN_IN_TRANSIT: "bg-yellow-100 text-yellow-700 border-yellow-300",
          RETURNED: "bg-gray-200 text-gray-800 border-gray-400"
      };

      // Nếu chưa có data (status undefined)
      if (!status) return <span className="text-[10px] bg-gray-50 text-gray-400 px-2 py-1 rounded border border-gray-200">SYNCING...</span>;

      return (
          <span className={`text-[10px] font-bold px-2 py-1 rounded border ${styles[status] || "bg-gray-50 text-gray-500"} uppercase shadow-sm`}>
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
      console.log("🔍 [FE CHECK] Đang kiểm tra quyền truy cập...");
      setIsCheckingRole(true); // Bắt đầu kiểm tra

      try {
          const res = await fetch(`${BACKEND_URL}/admin/users/me`, {
              headers: { "Authorization": `Bearer ${token}` }
          })
          
          // Nếu Token lỗi (User khách hoặc hết hạn) -> Redirect về trang mua hàng
          if (!res.ok) {
              console.warn("Token không hợp lệ. Chuyển hướng về Storefront.");
              localStorage.removeItem("medusa_token");
              router.push(`/${countryCode}`); // Chuyển về trang chủ
              return;
          }

          const { user } = await res.json()
          const role = user.metadata?.fabric_role;
          
          console.log(`   -> User: ${user.email} | Role: ${role}`);

          // LOGIC CHẶN: Chỉ cho phép sellerorgmsp
          if (role !== 'sellerorgmsp' || role === undefined) {
              console.error(`   ⛔ [BLOCK] Role '${role}' bị từ chối.`);
              setIsAuthorized(false) 
          } else {
              console.log(`   ✅ [ALLOW] Quyền hợp lệ.`);
              setIsAuthorized(true)
              loadSellerOrders(token) // Truyền token vào để load luôn
          }
      } catch (e) {
          console.error("   ❌ Lỗi xác thực:", e);
          setIsAuthorized(false)
          // Nếu token lỗi, coi như chưa đăng nhập
          localStorage.removeItem("medusa_token");
          setIsLoggedIn(false);
      } finally {
          // QUAN TRỌNG: Dù thành công hay thất bại cũng tắt loading
          setIsCheckingRole(false) 
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

  const handleShipOrder = async (orderId: string) => {
      if(!confirm("Xác nhận bàn giao đơn hàng này cho đơn vị vận chuyển?")) return;

      setIsShipping(orderId); // Bật loading cho đơn hàng này
      const token = localStorage.getItem("medusa_token");

      try {
          const res = await fetch(`${BACKEND_URL}/admin/fabric/orders/${orderId}/ship`, {
              method: "POST",
              headers: { 
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${token}`
              }
          });

          const result = await res.json();

          if (res.ok) {
              alert(" Thành công! ");
              loadSellerOrders(token || ""); // Load lại danh sách để cập nhật trạng thái
              // Đóng modal nếu đang mở đúng đơn hàng đó
              if (selectedOrder?.id === orderId) setSelectedOrder(null);
          } else {
              alert(" Lỗi: " + (result.error || "Thất bại"));
          }
      } catch (err) {
          alert(" Lỗi kết nối server");
      } finally {
          setIsShipping(null);
      }
  }

  const handleConfirmReturn = async (orderId: string) => {
      if(!confirm("Xác nhận bạn ĐÃ NHẬN ĐƯỢC hàng trả về từ đơn vị vận chuyển?")) return;

      setIsConfirmingReturn(orderId); // Bật loading
      const token = localStorage.getItem("medusa_token");

      try {
          const res = await fetch(`${BACKEND_URL}/admin/fabric/orders/${orderId}/confirm-return`, {
              method: "POST",
              headers: { 
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${token}`
              }
          });

          const result = await res.json();

          if (res.ok) {
              alert(" Đã xác nhận nhận hàng thành công!");
              loadSellerOrders(token || ""); // Load lại danh sách
              if (selectedOrder?.id === orderId) setSelectedOrder(null); // Đóng modal
          } else {
              alert(" Lỗi: " + (result.error || "Thất bại"));
          }
      } catch (err) {
          alert(" Lỗi kết nối server");
      } finally {
          setIsConfirmingReturn(null);
      }
  }

  // --- 2. EFFECT KHỞI TẠO ---
  useEffect(() => {
    const token = localStorage.getItem("medusa_token")
    if (token) { 
        setIsLoggedIn(true); 
        checkUserRole(token);
    } else {
        // Nếu không có token, tắt loading ngay để hiện form login
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
        // Sau khi login thành công, kiểm tra role ngay
        checkUserRole(data.token);
      } else {
        setLoginError("Email hoặc mật khẩu không đúng.")
        setIsLoadingLogin(false) // Chỉ tắt loading khi lỗi, nếu thành công để checkUserRole tắt
      }
    } catch (err) { 
        setLoginError("Lỗi kết nối server.") 
        setIsLoadingLogin(false)
    } 
  }

  const handleLogout = () => {
    localStorage.removeItem("medusa_token")
    window.location.reload()
  }

  // --- 4. LOAD DỮ LIỆU ---
  const loadSellerOrders = async (tokenOverride?: string) => {
    setIsLoadingData(true)
    const token = tokenOverride || localStorage.getItem("medusa_token")
    if (!token) return

    try {
        // Lấy Medusa Order
        const ordersRes = await fetch(`${BACKEND_URL}/admin/orders?limit=20&offset=0&fields=id,display_id,created_at,email,total,currency_code,status,payment_status`, {
            headers: { "Authorization": `Bearer ${token}` }
        })

        if (!ordersRes.ok) { 
            console.error("Backend chặn truy cập danh sách đơn hàng.");
            setIsLoadingData(false); 
            return 
        }

        const { orders: medusaOrders } = await ordersRes.json()
        const loadedOrders: OrderRow[] = []

        await Promise.all(
          medusaOrders.map(async (order: any) => {
            const row: OrderRow = {
                id: order.id,
                display_id: `#${order.display_id}`,
                created_at: new Date(order.created_at).toLocaleDateString('vi-VN'),
                publicData: {
                    email: order.email,
                    total: order.total,
                    currency_code: order.currency_code || "USD",
                    medusa_status: order.status,
                    medusa_payment: order.payment_status
                },
                status: "Pending",
                decryptedData: null
            }

            try {
              // Gọi API giải mã trên Blockchain
              const res = await fetch(`${BACKEND_URL}/admin/fabric/orders/${order.id}/decrypt/seller`, {
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
              })

              if (res.ok) {
                const data = await res.json()
                row.status = "Success"
                row.decryptedData = data
              } else {
                const errData = await res.json()
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

  // 1. Màn hình Loading (Tránh Flash nội dung)
  if (isCheckingRole) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600 font-medium">Đang xác thực quyền truy cập...</p>
          </div>
      )
  }

  // 2. Màn hình Chặn (Access Denied) - Chỉ hiện khi đã Login nhưng sai Role
  if (isLoggedIn && !isAuthorized) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
            <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md border border-red-100">
                <h1 className="text-2xl font-bold text-red-600 mb-2">TRUY CẬP BỊ TỪ CHỐI</h1>
                <p className="text-gray-600 mb-6">
                    Tài khoản này không có quyền truy cập trang <b>SELLER</b>.
                    <br/>Vui lòng liên hệ Admin hoặc đăng nhập tài khoản khác.
                </p>
                <button onClick={handleLogout} className="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 font-bold transition">
                    Đăng xuất
                </button>
            </div>
        </div>
      )
  }

  // 3. Màn hình Login (Nếu chưa Login)
  if (!isLoggedIn) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
           <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg border border-gray-100">
             <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mt-2 text-gray-800">Cổng Seller</h2>
                <p className="text-gray-500 text-sm">Đăng nhập để quản lý đơn hàng</p>
             </div>
             
             <form onSubmit={handleLogin} className="space-y-5">
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="seller@myfabric.com" required />
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
                  <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="••••••••" required />
               </div>
               
               {loginError && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100 flex items-center"> {loginError}</div>}
               
               <button type="submit" disabled={isLoadingLogin} className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 font-bold transition flex justify-center items-center">
                  {isLoadingLogin ? <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span> : "Đăng nhập"}
               </button>
             </form>
           </div>
        </div>
      )
  }

  // 4. Màn hình Dashboard Chính (Khi đã Login + Đúng Role)
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 relative">
      
      {/* --- MODAL CHI TIẾT --- */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Chi tiết đơn hàng {selectedOrder.display_id}</h2>
                        <p className="text-sm text-gray-500 mt-1">{(selectedOrder.created_at)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600 mb-1 text-2xl">&times;</button>
                        {selectedOrder.decryptedData && (
                            <span className="px-2 py-1 bg-white rounded text-[10px] font-bold text-gray-500 border border-gray-200 shadow-sm">
                            {selectedOrder.decryptedData.status}
                            </span>
                        )}
                    </div>
                </div>
                
                <div className="p-6 space-y-6">
                    {/* Thông tin khách hàng */}
                    <div className="flex items-start gap-4 bg-gray-50 p-4 rounded-lg">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xl">👤</div>
                        <div>
                            <div className="font-bold text-gray-800">{selectedOrder.decryptedData?.customerName}</div>
                            <div className="text-sm text-gray-600 mt-1">{selectedOrder.decryptedData?.shipping_address}</div>
                        </div>
                    </div>

                    {/* Danh sách sản phẩm đầy đủ */}
                    <div>
                        <h3 className="font-bold text-gray-700 mb-3 border-b pb-2">Danh sách sản phẩm ({selectedOrder.decryptedData?.product_lines.length})</h3>
                        <ul className="space-y-3">
                            {selectedOrder.decryptedData?.product_lines.map((p: any, i: number) => (
                                <li key={i} className="flex justify-between items-start">
                                    <div className="flex gap-3">
                                        <div>
                                            <div className="text-gray-800 font-medium text-sm">{p.product_name}</div>
                                            <div className="text-xs text-gray-500">Số lượng: x{p.quantity}</div>
                                        </div>
                                    </div>
                                    <span className="font-bold text-gray-900 text-sm">
                                        {formatPrice(p.subtotal, selectedOrder.publicData.currency_code)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Tổng kết tài chính */}
                    <div className="space-y-2 pt-4 border-t border-dashed">
                        <div className="flex justify-between text-sm text-gray-600">
                            <span>Tổng tiền hàng:</span>
                            <span>{formatPrice(selectedOrder.decryptedData?.amount_untaxed, selectedOrder.publicData.currency_code)}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold text-blue-700 pt-2 border-t">
                            <span>Tổng thanh toán:</span>
                            <span>{formatPrice((selectedOrder.decryptedData?.amount_untaxed || 0) + (selectedOrder.decryptedData?.shipping_fee || 0), selectedOrder.publicData.currency_code)}</span>
                        </div>
                    </div>

                    {/* Nút hành động trong Modal */}
                    <div className="pt-4 space-y-3">
                        {/* CASE 1: GIAO HÀNG (Logic cũ) */}
                        {selectedOrder.status === "Success" && selectedOrder.decryptedData && 
                         ((selectedOrder.decryptedData.paymentMethod === 'PREPAID' && selectedOrder.decryptedData.status === 'PAID') ||
                          (selectedOrder.decryptedData.paymentMethod === 'COD' && selectedOrder.decryptedData.status === 'CREATED')) && (
                                <button 
                                    onClick={() => handleShipOrder(selectedOrder.id)}
                                    disabled={isShipping === selectedOrder.id}
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg transition"
                                >
                                    {isShipping === selectedOrder.id ? "Đang xử lý..." : " BÀN GIAO VẬN CHUYỂN NGAY"}
                                </button>
                        )}

                        {/* CASE 2: NHẬN HÀNG TRẢ (Logic MỚI) */}
                        {selectedOrder.status === "Success" && selectedOrder.decryptedData?.status === 'RETURN_IN_TRANSIT' && (
                                <button 
                                    onClick={() => handleConfirmReturn(selectedOrder.id)}
                                    disabled={isConfirmingReturn === selectedOrder.id}
                                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-lg transition flex justify-center items-center gap-2"
                                >
                                    {isConfirmingReturn === selectedOrder.id ? (
                                        "Đang xử lý..."
                                    ) : (
                                        <>
                                            <span></span> XÁC NHẬN ĐÃ NHẬN HÀNG TRẢ
                                        </>
                                    )}
                                </button>
                        )}
                        
                        {/* Hiển thị trạng thái tĩnh nếu đã hoàn tất */}
                        {selectedOrder.decryptedData?.status === 'RETURNED' && (
                             <div className="w-full py-3 bg-gray-100 text-gray-600 rounded-lg font-bold text-center border border-gray-200">
                                Đơn hàng đã hoàn trả thành công
                             </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* --- DASHBOARD (TABLE VIEW) --- */}
      <nav className="bg-white border-b px-8 py-4 flex justify-between items-center shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-blue-700">Kênh Người Bán</h1>
        </div>
        <div className="flex gap-3">
             <button onClick={() => loadSellerOrders()} className="px-4 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium transition">
                {isLoadingData ? "..." : "Làm mới"}
             </button>
             <button onClick={handleLogout} className="px-4 py-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 text-sm font-medium transition">Thoát</button>
        </div>
      </nav>

      <div className="p-8 max-w-7xl mx-auto">
         
         {/* Toolbar */}
         <div className="flex flex-wrap gap-4 mb-6 items-center justify-between">
             <div className="flex gap-3 items-center">
                <input 
                    placeholder="Search" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64 bg-white shadow-sm" 
                />
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white shadow-sm cursor-pointer outline-none">
                    <option value="ALL">All Status</option>
                    <option value="CREATED">Created</option>
                    <option value="PAID">Paid</option>
                    <option value="SHIPPED">Shipped</option>
                    <option value="DELIVERED">Delivered</option>
                    <option value="SETTLED">Settled</option>
                    <option value="DELIVERED_COD_PENDING">COD Pending</option>
                    <option value="CANCELLED">Cancelled</option>
                </select>
                <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white shadow-sm cursor-pointer outline-none">
                    <option value="ALL">All Payment</option>
                    <option value="PREPAID">Prepaid</option>
                    <option value="COD">COD</option>
                </select>
                                </div>

             <div className="relative" ref={sortMenuRef}>
                <button onClick={() => setShowSortMenu(!showSortMenu)} className="flex items-center justify-center w-9 h-9 border border-gray-300 rounded-md bg-white hover:bg-gray-50 transition shadow-sm">
                    <Icons.Sort />
                </button>
                {showSortMenu && (
                    <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1">
                        <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b">Sort By</div>
                        {[{ label: 'Display ID', key: 'display_id' }, { label: 'Created Date', key: 'created_at' }, { label: 'Updated Date', key: 'updated_at' }].map((item) => (
                            <div key={item.key} onClick={() => { setSortKey(item.key as SortKey); setShowSortMenu(true); }} className={`px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 flex justify-between ${sortKey === item.key ? 'font-medium text-blue-600' : 'text-gray-700'}`}>
                                {item.label} {sortKey === item.key && <Icons.Check />}
                            </div>
                        ))}
                        <div className="h-px bg-gray-100 my-1"></div>
                        {[{ label: 'Ascending', dir: 'asc' }, { label: 'Descending', dir: 'desc' }].map((item) => (
                            <div key={item.dir} onClick={() => { setSortDir(item.dir as SortDirection); setShowSortMenu(false); }} className={`px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 flex justify-between ${sortDir === item.dir ? 'font-medium text-blue-600' : 'text-gray-700'}`}>
                                {item.label} {sortDir === item.dir && <Icons.Check />}
                            </div>
                        ))}
                    </div>
                                        )}
                                    </div>
                                </div>

         {/* Table View */}
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
                                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                                            {(order.decryptedData?.customerName || order.publicData.email).charAt(0).toUpperCase()}
                                            </div>
                                        { order.publicData.email || order.decryptedData?.customerName}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {order.status === "Success" && order.decryptedData ? (
                                        getBlockchainStatusBadge(order.decryptedData.status)
                                    ) : (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">SYNCING</span>
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
                                    ? formatPrice(order.decryptedData.amount_untaxed, order.publicData.currency_code) 
                                    : "-"}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
            
            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-200 bg-white flex items-center justify-between">
                <span className="text-xs text-gray-500">Showing {processedOrders.length} results</span>
                <div className="flex gap-2">
                    <button disabled className="px-3 py-1 border border-gray-300 rounded text-xs text-gray-400 cursor-not-allowed">Prev</button>
                    <button disabled className="px-3 py-1 border border-gray-300 rounded text-xs text-gray-400 cursor-not-allowed">Next</button>
                    </div>
            </div>
         </div>
      </div>
    </div>
  )
}