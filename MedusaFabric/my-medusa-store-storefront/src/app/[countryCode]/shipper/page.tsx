// my-medusa-store-storefront/src/app/[countryCode]/shipper/page.tsx

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
      status: string;        // Blockchain Status
      paymentMethod: string; // COD/PREPAID
  } | null; 
  error?: string;
}

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
  const [isDelivering, setIsDelivering] = useState<string | null>(null); // State loading cho nút

  // Helper Badge
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
      };
      
      if (!status) return <span className="text-[10px] bg-gray-50 text-gray-400 px-2 py-1 rounded border border-gray-200">SYNCING...</span>;

      return (
          <span className={`text-[10px] font-bold px-2 py-1 rounded border ${styles[status] || "bg-gray-50 text-gray-500"} uppercase shadow-sm`}>
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
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
           <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg border border-gray-100">
             <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mt-2 text-gray-800">Cổng Vận Chuyển</h2>
                <p className="text-gray-500 text-sm">Đăng nhập để nhận đơn hàng</p>
             </div>
             <form onSubmit={handleLogin} className="space-y-5">
                 <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="shipper@myfabric.com" required />
                 <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="••••••••" required />
                 
                 {loginError && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100 flex items-center"> {loginError}</div>}
                 
                 <button type="submit" disabled={isLoadingLogin} className="w-full bg-orange-600 text-white p-3 rounded-lg hover:bg-orange-700 font-bold transition flex justify-center items-center">
                    {isLoadingLogin ? <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span> : "Truy cập"}
                 </button>
             </form>
           </div>
        </div>
      )
  }

  // 4. Dashboard State
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-orange-700">Cổng Vận Chuyển</h1>
        </div>
        <div className="flex gap-3">
            <button onClick={() => loadShipperOrders()} className="px-4 py-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 font-medium transition">
                {isLoadingData ? "Đang tải..." : "Làm mới"}
            </button>
            <button onClick={handleLogout} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 font-medium transition">Thoát</button>
        </div>
      </nav>

      <div className="p-6 max-w-7xl mx-auto">
         {orders.length === 0 && !isLoadingData ? (
              <div className="text-center py-20 text-gray-500">
                  Chưa có đơn vận chuyển nào.
              </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {orders.map((order) => (
                    <div key={order.id} className="bg-white rounded-xl border border-orange-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col">
                        
                        {/* Header Card */}
                        <div className="bg-orange-50/50 px-5 py-4 border-b border-orange-100 flex justify-between items-start">
                            <div>
                                <div className="font-bold text-lg text-gray-800">{order.display_id}</div>
                                <div className="text-[10px] text-gray-500 font-mono mt-0.5 select-all" title="Real Blockchain ID">
                                    {order.id}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">{order.created_at}</div>
                            </div>

                           {/* STATUS & PAYMENT TỪ BLOCKCHAIN */}
                           <div className="text-right flex flex-col items-end gap-1">
                                {/* <span className="block text-[10px] font-bold uppercase text-gray-500 mb-1 bg-gray-200 px-2 rounded">
                                   {getPaymentLabel(order.publicData.payment_method_id)}
                                </span> */}
                               {/* --- HIỂN THỊ STATUS BADGE CHO SHIPPER --- */}
                               {order.status === "Success" && order.decryptedData ? (
                                   <>
                                       {/* Status nằm trên */}
                                       {getBlockchainStatusBadge(order.decryptedData.status)}
                                       
                                       {/* Payment Method nằm dưới */}
                                       <span className="block text-[10px] font-bold uppercase text-gray-500 mb-1 bg-gray-200 px-2 rounded">
                                           {order.decryptedData.paymentMethod}
                                       </span>
                                   </>                               
                                ) : (
                                   <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-1 rounded">SYNCING...</span>
                               )}
                           </div>
                       </div>

                        {/* Body Card */}
                        <div className="p-5 flex-grow flex flex-col gap-3">
                           {order.decryptedData ? (
                               <div className="flex flex-col h-full">
                                   <div className="space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-lg flex-shrink-0">📍</div>
                                        <div>
                                            <div className="font-bold text-gray-900 text-sm">{order.decryptedData.customerName}</div>
                                            <div className="text-sm text-gray-600 mt-1 leading-relaxed bg-orange-50 p-2 rounded border border-orange-100">
                                                {order.decryptedData.shipping_address}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 pl-1 text-sm text-gray-700">
                                        <span>📞</span> 
                                        <span className="font-medium">{order.decryptedData.shipping_phone}</span>
                                    </div>
                                    
                                    {/* PHÍ SHIP (Hiển thị cho Shipper xem doanh thu vận chuyển) */}
                                    <div className="flex justify-between items-center pt-2 border-t border-dashed border-gray-200 mt-2">
                                        <span className="text-xs text-gray-500 uppercase font-semibold">Phí vận chuyển</span>
                                        <span className="text-sm font-bold text-orange-800">
                                            {formatPrice(order.decryptedData.shipping_fee, order.publicData.currency_code)}
                                        </span>
                                    </div>
                                </div>

                                   {/* --- NÚT BẤM (CẬP NHẬT) --- */}
                                   <div className="mt-auto pt-4 border-t border-dashed border-gray-200">
                                        {/* ĐIỀU KIỆN HIỆN NÚT: PREPAID và SHIPPED */}
                                        {order.decryptedData.paymentMethod === 'PREPAID' && order.decryptedData.status === 'SHIPPED' ? (
                                            
                                            <button 
                                                onClick={() => handleConfirmDelivery(order.id)}
                                                disabled={isDelivering === order.id}
                                                className={`w-full py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition shadow-sm
                                                    ${isDelivering === order.id 
                                                        ? "bg-gray-300 text-gray-500 cursor-not-allowed" 
                                                        : "bg-teal-600 hover:bg-teal-700 text-white"
                                                    }`}
                                            >
                                                {isDelivering === order.id ? <>Processing...</> : <> Xác nhận Giao Hàng</>}
                                            </button>

                                        ) : (
                                            /* Trạng thái khác */
                                            <div className="text-center">
                                                {['DELIVERED', 'DELIVERED_COD_PENDING', 'COD_REMITTED', 'SETTLED'].includes(order.decryptedData.status) ? (
                                                    <div className="flex items-center justify-center gap-1 text-teal-700 font-medium text-xs bg-teal-50 px-3 py-1 rounded-full border border-teal-100">
                                                        <span></span> Giao thành công
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-gray-400 italic">
                                                        {order.decryptedData.paymentMethod === 'COD' 
                                                            ? "Đơn COD cần quy trình thu tiền riêng" 
                                                            : "Chưa đến bước giao hàng"}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                   </div>
                               </div>
                           ) : (
                                <div className="text-center py-8 flex flex-col items-center justify-center h-full text-gray-300">
                                    <span className="text-xs">
                                        {order.error || "Dữ liệu được mã hóa"}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Footer Card: COD (Quan trọng nhất với Shipper) */}
                        {order.status === "Success" && order.decryptedData && (
                            <div className="px-5 py-4 bg-orange-50 border-t border-orange-100 flex justify-between items-center">
                                <div>
                                   <span className="text-xs font-bold text-orange-800 uppercase tracking-wide block">Cần thu hộ (COD)</span>
                                   {order.decryptedData.cod_amount === 0 && <span className="text-[10px] text-green-600 font-bold">(Đã thanh toán)</span>}
                               </div>
                               <span className="text-xl font-bold text-orange-700">{formatPrice(order.decryptedData.cod_amount, order.publicData.currency_code)}</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>
          )}
      </div>
    </div>
  )
}