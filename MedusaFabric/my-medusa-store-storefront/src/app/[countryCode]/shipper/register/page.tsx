"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function ShipperRegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    carrier_name: "",
    phone: "",
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage("")

    // Lấy Key từ biến môi trường
    const publishableApiKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""
    console.log("Debug API Key:", publishableApiKey)
    if (!publishableApiKey) {
      setMessage("ERROR")
      console.error("❌ Lỗi Config: Chưa có Publishable API Key trong .env")
      setLoading(false)
      return
  }
    try {
      // 👇 ĐÃ SỬA: Dùng trực tiếp Port 9000
      const res = await fetch("http://localhost:9000/store/market/register-shipper", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-publishable-api-key": publishableApiKey,
        },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
          const errorText = await res.text(); // Lấy raw text lỗi
          console.error("Server Error Raw:", errorText);
          try {
              const errorJson = JSON.parse(errorText);
              setMessage("ERROR")
              console.log(`❌ Lỗi Server: ${errorJson.message || errorJson.error}`);
          } catch {
              console.log(`❌ Lỗi Server: ${errorText}`);
          }
          return; // Dừng lại
      }

      const data = await res.json()

      if (res.ok) {
        setMessage("✅ Đăng ký thành công! Vui lòng chờ Admin duyệt.")
        setFormData({ email: "", password: "", carrier_name: "", phone: "" })
      } else {
        setMessage("ERROR")
        console.log(`❌ Lỗi: ${data.error || data.message || "Không xác định"}`)
      }
    } catch (error) {
      console.error(error)
      setMessage("ERROR")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-20 p-6 border rounded-lg shadow-lg bg-white">
      <h1 className="text-2xl font-bold mb-6 text-center">Đăng Ký Đơn Vị Vận Chuyển</h1>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Tên Đơn Vị (Carrier Name)</label>
          <input
            type="text"
            name="carrier_name"
            required
            className="w-full border p-2 rounded"
            placeholder="Ví dụ: Giao Hàng Nhanh"
            value={formData.carrier_name}
            onChange={handleChange}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            name="email"
            required
            className="w-full border p-2 rounded"
            placeholder="shipper@example.com"
            value={formData.email}
            onChange={handleChange}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Số điện thoại</label>
          <input
            type="text"
            name="phone"
            required
            className="w-full border p-2 rounded"
            placeholder="09xxx"
            value={formData.phone}
            onChange={handleChange}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Mật khẩu</label>
          <input
            type="password"
            name="password"
            required
            className="w-full border p-2 rounded"
            placeholder="******"
            value={formData.password}
            onChange={handleChange}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition disabled:bg-gray-400"
        >
          {loading ? "Đang xử lý..." : "Đăng Ký Ngay"}
        </button>
      </form>

      {message && (
        <div className={`mt-4 p-3 rounded text-center ${message.startsWith("✅") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {message}
        </div>
      )}
    </div>
  )
}