// src\app\[countryCode]\partner\page.tsx

"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"


const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

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
      // --- QUAN TRỌNG: Status từ Blockchain ---
      status: string;       // CREATED, PAID, SHIPPED...
      paymentMethod: string; // COD, PREPAID
  } | null; 
  error?: string;
}

export default function SellerDashboard() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  // Khởi tạo Router và Params
  const router = useRouter()
  const params = useParams()
  const countryCode = params?.countryCode || "us"
  const [isShipping, setIsShipping] = useState<string | null>(null); 
  
  // State quản lý đăng nhập & quyền
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isCheckingRole, setIsCheckingRole] = useState(true) // <--- QUAN TRỌNG: Mặc định là đang kiểm tra
  const [isAuthorized, setIsAuthorized] = useState(false) 
  
  // State dữ liệu
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [isLoadingLogin, setIsLoadingLogin] = useState(false)
  const [loginError, setLoginError] = useState("")
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);

  // --- HELPER: BADGE CHO TRẠNG THÁI BLOCKCHAIN ---
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


  // --- 1. HÀM KIỂM TRA ROLE (QUAN TRỌNG) ---
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
            //   alert("✅ Thành công! TxID: " + result.tx_id);
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
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      {/* --- MODAL CHI TIẾT SẢN PHẨM --- */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Chi tiết đơn hàng {selectedOrder.display_id}</h2>
                        <p className="text-sm text-gray-500 mt-1">{selectedOrder.created_at}</p>
                    </div>
                    <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
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
                    <div className="pt-4">
                        {selectedOrder.status === "Success" && selectedOrder.decryptedData && (
                            ((selectedOrder.decryptedData.paymentMethod === 'PREPAID' && selectedOrder.decryptedData.status === 'PAID') ||
                             (selectedOrder.decryptedData.paymentMethod === 'COD' && selectedOrder.decryptedData.status === 'CREATED')) ? (
                                <button 
                                    onClick={() => handleShipOrder(selectedOrder.id)}
                                    disabled={isShipping === selectedOrder.id}
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg transition"
                                >
                                    {isShipping === selectedOrder.id ? "Đang xử lý..." : " BÀN GIAO VẬN CHUYỂN NGAY"}
                                </button>
                            ) : (
                                <div className="text-center text-gray-400 text-sm italic">Trạng thái hiện tại: {selectedOrder.decryptedData.status}</div>
                            )
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-blue-700">Kênh Người Bán</h1>
        </div>
        <div className="flex gap-3">
             <button onClick={() => loadSellerOrders()} className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium transition">
                {isLoadingData ? "Đang tải..." : "Làm mới"}
             </button>
             <button onClick={handleLogout} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 font-medium transition">Đăng xuất</button>
        </div>
      </nav>

      <div className="p-6 max-w-7xl mx-auto">
          {orders.length === 0 && !isLoadingData ? (
              <div className="text-center py-20 text-gray-500">
                  Chưa có đơn hàng nào cần xử lý.
              </div>
          ) : (
            <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                {orders.map((order) => (
                    <div key={order.id} className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden hover:shadow-md transition-shadow duration-300">
                        
                        {/* Header Card */}
                        <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-start">
                            <div>
                                <span className="font-bold text-gray-900 text-lg">{order.display_id}</span>
                                <div className="text-[10px] text-gray-400 font-mono mt-1 select-all" title="Blockchain ID">
                                    {order.id}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">{order.created_at}</div>
                            </div>
 
                            {/* HIỂN THỊ TRẠNG THÁI BLOCKCHAIN */}
                            <div className="flex flex-col gap-1 items-end">
                                {order.status === 'Success' && order.decryptedData ? (
                                    <>
                                        {getBlockchainStatusBadge(order.decryptedData.status)}
                                        {getPaymentMethodBadge(order.decryptedData.paymentMethod)}
                                    </>
                                ) : (
                                    <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-1 rounded">PENDING CHAIN</span>
                                )}
                            </div>
                        </div>

                        {/* Body Card */}
                        <div className="p-5 flex-grow flex flex-col">
                            {order.status === "Success" && order.decryptedData ? (
                            <div className="flex flex-col h-full">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">👤</div>
                                        <div>
                                            <div className="text-sm font-bold text-gray-800">{order.decryptedData.customerName}</div>
                                            <div className="text-xs text-gray-500">Khách hàng</div>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="text-xs font-bold text-gray-500 uppercase">Sản phẩm</div>
                                            <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded text-gray-600 font-bold">
                                                {order.decryptedData.product_lines.length}
                                            </span>
                                        </div>
                                        
                                        <ul className="space-y-2 text-sm">
                                            {/* --- LOGIC HIỂN THỊ TỐI ĐA 2 SẢN PHẨM --- */}
                                            {order.decryptedData.product_lines.slice(0, 2).map((p: any, i: number) => (
                                                <li key={i} className="flex justify-between items-start border-b border-dashed border-gray-200 pb-1 last:border-0 last:pb-0">
                                                    <span className="text-gray-700 pr-2 line-clamp-1 w-2/3" title={p.product_name}>
                                                        {p.product_name} <span className="text-gray-400 text-xs">x{p.quantity}</span>
                                                    </span>
                                                    <span className="font-medium whitespace-nowrap text-gray-900">
                                                        {formatPrice(p.subtotal, order.publicData.currency_code)}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>

                                        {/* --- NÚT XEM THÊM NẾU CÓ > 2 SẢN PHẨM --- */}
                                        {order.decryptedData.product_lines.length > 2 && (
                                            <button 
                                                onClick={() => setSelectedOrder(order)}
                                                className="w-full mt-2 text-xs text-blue-600 font-medium hover:underline text-center py-1 bg-blue-50 rounded hover:bg-blue-100 transition"
                                            >
                                                + Xem thêm {order.decryptedData.product_lines.length - 2} sản phẩm khác
                                            </button>
                                        )}
                                    </div>
                                </div>

                                    {/* --- PHẦN NÚT BẤM (CẬP NHẬT) --- */}
                                    <div className="mt-auto pt-4 border-t border-dashed border-gray-200">
                                        {((order.decryptedData.paymentMethod === 'PREPAID' && order.decryptedData.status === 'PAID') ||
                                          (order.decryptedData.paymentMethod === 'COD' && order.decryptedData.status === 'CREATED')) ? (
                                            
                                            <button 
                                                onClick={() => handleShipOrder(order.id)}
                                                disabled={isShipping === order.id}
                                                className={`w-full py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition shadow-sm
                                                    ${isShipping === order.id 
                                                        ? "bg-gray-300 text-gray-500 cursor-not-allowed" 
                                                        : "bg-indigo-600 hover:bg-indigo-700 text-white"
                                                    }`}
                                            >
                                                {isShipping === order.id ? <>Running...</> : <> Giao Vận Chuyển</>}
                                            </button>

                                        ) : (
                                            /* Nếu không đủ điều kiện hoặc đã giao -> Chỉ hiển thị thông báo text */
                                            <div className="flex flex-col items-center gap-2 text-center">
                                                {['SHIPPED', 'DELIVERED', 'DELIVERED_COD_PENDING', 'COD_REMITTED', 'SETTLED'].includes(order.decryptedData.status) ? (
                                                    <div className="flex items-center justify-center gap-1 text-green-600 font-medium text-xs bg-green-50 px-3 py-1 rounded-full border border-green-100 mb-1">
                                                        <span></span> Đã bàn giao vận chuyển
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-gray-400 italic mt-1">
                                                        Chờ thanh toán hoặc xử lý...
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                    <span className="text-xs text-gray-500">{order.error || "Đang đồng bộ Blockchain..."}</span>
                                </div>
                            )}
                        </div>

                        {/* Footer - DOANH THU */}
                        <div className="px-5 py-4 bg-blue-50 border-t border-blue-100 flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wide">Doanh thu</span>
                            </div>
                            <span className="text-xl font-bold text-blue-700">
                                {order.decryptedData 
                                    ? formatPrice(order.decryptedData.amount_untaxed, order.publicData.currency_code) 
                                    : "-"}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
          )}
      </div>
    </div>
  )
}