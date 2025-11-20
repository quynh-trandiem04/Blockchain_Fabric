"use client"

import { useState, useEffect } from "react"

const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

export default function PartnerDashboard() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loginError, setLoginError] = useState("")
  const [orderId, setOrderId] = useState("")
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState("")

  // Kiểm tra xem đã có token chưa khi tải trang
  useEffect(() => {
    const token = localStorage.getItem("medusa_token")
    if (token) setIsLoggedIn(true)
  }, [])

  // --- 1. XỬ LÝ ĐĂNG NHẬP (LƯU TOKEN) ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError("")
    try {
      const res = await fetch(`${BACKEND_URL}/auth/user/emailpass`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (res.ok && data.token) {
        // === FIX: LƯU TOKEN VÀO STORAGE ===
        localStorage.setItem("medusa_token", data.token)
        setIsLoggedIn(true)
      } else {
        setLoginError("Đăng nhập thất bại. " + (data.message || ""))
      }
    } catch (err) {
      setLoginError("Lỗi kết nối đến server.")
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("medusa_token")
    window.location.reload()
  }

  // --- 2. HÀM GỌI API GIẢI MÃ (DÙNG TOKEN) ---
  const decryptData = async (role: "seller" | "shipper") => {
    setError("")
    setResult(null)
    
    // === FIX: LẤY TOKEN TỪ STORAGE ===
    const token = localStorage.getItem("medusa_token")
    if (!token) {
        setError("Vui lòng đăng nhập lại.")
        return
    }

    try {
      const endpoint = `${BACKEND_URL}/admin/fabric/orders/${orderId}/decrypt/${role}`
      
      const res = await fetch(endpoint, {
        method: "GET",
        headers: { 
            "Content-Type": "application/json",
            // === FIX: GỬI TOKEN QUA HEADER (Thay vì Cookie) ===
            "Authorization": `Bearer ${token}` 
        },
      })

      const contentType = res.headers.get("content-type");
      let data;
      
      if (contentType && contentType.indexOf("application/json") !== -1) {
          data = await res.json();
      } else {
          const text = await res.text();
          data = { error: text || `Lỗi HTTP ${res.status}` };
      }

      if (res.ok) {
        setResult(data)
      } else {
        setError(data.message || data.error || `Lỗi từ server: ${res.status}`);
      }
    } catch (err: any) {
      setError("Lỗi kết nối: " + err.message)
    }
  }

  // --- GIAO DIỆN (Giữ nguyên cấu trúc, chỉ sửa nút đăng xuất) ---
  return (
    <div className="min-h-screen bg-gray-100 p-10 font-sans">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded shadow">
        <h1 className="text-2xl font-bold mb-6 text-center text-blue-600">
          Cổng thông tin Đối tác (Fabric Blockchain)
        </h1>

        {!isLoggedIn ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-sm">
              Vui lòng đăng nhập bằng tài khoản Seller hoặc Shipper.
            </div>
            <div>
              <label className="block mb-1 font-medium">Email:</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border p-2 rounded" placeholder="seller@myfabric.com" required />
            </div>
            <div>
              <label className="block mb-1 font-medium">Mật khẩu:</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border p-2 rounded" placeholder="******" required />
            </div>
            {loginError && <p className="text-red-500 text-sm">{loginError}</p>}
            <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700">Đăng Nhập</button>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-green-50 p-3 rounded border border-green-200">
              <span className="text-green-800 font-medium">Đã đăng nhập</span>
              <button onClick={handleLogout} className="text-sm text-red-600 underline">Đăng xuất</button>
            </div>

            <div>
              <label className="block mb-1 font-bold">Nhập Mã Đơn Hàng (Order ID):</label>
              <input type="text" value={orderId} onChange={(e) => setOrderId(e.target.value)} className="w-full border p-2 rounded" placeholder="Ví dụ: MEDUSA_003" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => decryptData("seller")} className="bg-indigo-600 text-white p-3 rounded hover:bg-indigo-700 font-bold">🔍 Giải mã (Seller)</button>
              <button onClick={() => decryptData("shipper")} className="bg-orange-600 text-white p-3 rounded hover:bg-orange-700 font-bold">🚚 Giải mã (Shipper)</button>
            </div>

            <div className="mt-6 border-t pt-4">
              <h3 className="font-bold text-lg mb-2">Kết quả từ Blockchain:</h3>
              {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4"><p className="font-bold">Lỗi:</p><p>{error}</p></div>}
              {result && <div className="bg-gray-800 text-green-400 p-4 rounded overflow-auto text-sm font-mono"><pre>{JSON.stringify(result, null, 2)}</pre></div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}