// src\app\[countryCode]\partner\page.tsx

"use client"

import { useState, useEffect } from "react"

const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

interface OrderRow {
  id: string;
  display_id: string;
  created_at: string;
  publicData: {
    email: string;
    currency_code: string;
    total: number; 
  };
  status: "Pending" | "Success" | "Error";
  decryptedData: any; 
  error?: string;
}

export default function SellerDashboard() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  
  // State quản lý đăng nhập & quyền
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isCheckingRole, setIsCheckingRole] = useState(true) // <--- QUAN TRỌNG: Mặc định là đang kiểm tra
  const [isAuthorized, setIsAuthorized] = useState(false) 
  
  // State dữ liệu
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [isLoadingLogin, setIsLoadingLogin] = useState(false)
  const [loginError, setLoginError] = useState("")

  // --- 1. HÀM KIỂM TRA ROLE (QUAN TRỌNG) ---
  const checkUserRole = async (token: string) => {
      console.log("🔍 [FE CHECK] Đang kiểm tra quyền truy cập...");
      setIsCheckingRole(true); // Bắt đầu kiểm tra

      try {
          const res = await fetch(`${BACKEND_URL}/admin/users/me`, {
              headers: { "Authorization": `Bearer ${token}` }
          })
          
          if (!res.ok) {
              throw new Error("Token không hợp lệ hoặc hết hạn");
          }

          const { user } = await res.json()
          const role = user.metadata?.fabric_role;
          
          console.log(`   -> User: ${user.email} | Role: ${role}`);

          // LOGIC CHẶN: Chỉ cho phép sellerorgmsp hoặc superadmin
          if (role !== 'sellerorgmsp' && user.email !== 'superadmin@test.com') {
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
        // Gọi API lấy danh sách ID (Backend đã whitelist /admin/orders)
        const ordersRes = await fetch(`${BACKEND_URL}/admin/orders?limit=20&offset=0&fields=id,display_id,created_at,email,total,currency_code`, {
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
                row.error = errData.error || "Decrypt Failed"
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
                <div className="text-5xl mb-4">⛔</div>
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
                <span className="text-4xl">🏪</span>
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
               
               {loginError && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100 flex items-center">⚠️ {loginError}</div>}
               
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
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-2">
            <span className="text-2xl">🏪</span>
            <h1 className="text-xl font-bold text-blue-700">Kênh Người Bán</h1>
        </div>
        <div className="flex gap-3">
             <button onClick={() => loadSellerOrders()} className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium transition">
                {isLoadingData ? "Đang tải..." : "🔄 Làm mới"}
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
                            <div className="text-right">
                                {order.status === 'Success' 
                                    ? <span className="text-[10px] text-green-700 font-bold bg-green-100 border border-green-200 px-2 py-1 rounded-full">BLOCKCHAIN SECURED</span>
                                    : <span className="text-[10px] text-gray-500 bg-gray-200 px-2 py-1 rounded-full">PENDING</span>
                                }
                            </div>
                        </div>

                        {/* Body Card */}
                        <div className="p-5 flex-grow">
                            {order.status === "Success" && order.decryptedData ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">👤</div>
                                        <div>
                                            <div className="text-sm font-bold text-gray-800">{order.decryptedData.customerName}</div>
                                            <div className="text-xs text-gray-500">Khách hàng</div>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <div className="text-xs font-bold text-gray-500 uppercase mb-2">Sản phẩm</div>
                                        <ul className="space-y-2 text-sm">
                                            {order.decryptedData.product_lines.map((p: any, i: number) => (
                                                <li key={i} className="flex justify-between items-start border-b border-dashed border-gray-200 pb-1 last:border-0 last:pb-0">
                                                    <span className="text-gray-700 pr-2">
                                                        {p.product_name} <span className="text-gray-400 text-xs">x{p.quantity}</span>
                                                    </span>
                                                    <span className="font-medium whitespace-nowrap text-gray-900">
                                                        {formatPrice(p.subtotal, order.publicData.currency_code)}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                    <span className="text-2xl mb-2">🔒</span>
                                    <span className="text-xs text-gray-500">
                                        {order.error || "Không có quyền giải mã dữ liệu này"}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Footer - DOANH THU */}
                        <div className="px-5 py-4 bg-blue-50 border-t border-blue-100 flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wide">Doanh thu thuần</span>
                                <span className="text-[10px] text-blue-600">(Chưa tính Ship/Tax)</span>
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