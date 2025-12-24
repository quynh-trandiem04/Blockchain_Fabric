"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function PartnerRegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    business_name: "",
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

    // Get API Key from environment
    const publishableApiKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""
    console.log("Debug API Key:", publishableApiKey)
    if (!publishableApiKey) {
      setMessage("Error: Configuration missing - API Key not found in .env")
      console.error("Error Config: Publishable API Key missing in .env")
      setLoading(false)
      return
    }
    try {
      const res = await fetch("http://localhost:9000/store/market/register-seller", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-publishable-api-key": publishableApiKey,
        },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const errorText = await res.text()
        console.error("Server Error Raw:", errorText)
        try {
          const errorJson = JSON.parse(errorText)
          setMessage("Error: Registration failed")
          console.log(`Server Error: ${errorJson.message || errorJson.error}`)
        } catch {
          console.log(`Server Error: ${errorText}`)
        }
        return
      }

      const data = await res.json()

      if (res.ok) {
        setMessage("Registration successful! Please wait for admin approval.")
        setFormData({ email: "", password: "", business_name: "", phone: "" })
      } else {
        setMessage("Error: Registration failed")
        console.log(`Error: ${data.error || data.message || "Unknown error"}`)
      }
    } catch (error) {
      console.error(error)
      setMessage("Error: Server connection failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold mb-8 text-center text-gray-900">Partner Registration</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-800">Business Name</label>
            <input
              type="text"
              name="business_name"
              required
              className="w-full border border-gray-300 p-3 rounded-md focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-600"
              placeholder="e.g. ABC Trading Company"
              value={formData.business_name}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-800">Email Address</label>
            <input
              type="email"
              name="email"
              required
              className="w-full border border-gray-300 p-3 rounded-md focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-600"
              placeholder="partner@example.com"
              value={formData.email}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-800">Phone Number</label>
            <input
              type="text"
              name="phone"
              required
              className="w-full border border-gray-300 p-3 rounded-md focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-600"
              placeholder="+1 (555) 123-4567"
              value={formData.phone}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-800">Password</label>
            <input
              type="password"
              name="password"
              required
              className="w-full border border-gray-300 p-3 rounded-md focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-600"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-gray-900 text-white py-3 rounded-md hover:bg-gray-800 transition disabled:bg-gray-400 font-semibold mt-2"
          >
            {loading ? "Processing..." : "Register Now"}
          </button>
        </form>

        {message && (
          <div className={`mt-6 p-4 rounded-md text-center font-semibold ${message.toLowerCase().includes("success") ? "bg-gray-100 text-gray-900 border border-gray-300" : "bg-red-50 text-red-900 border border-red-300"}`}>
            {message}
          </div>
        )}

        <div className="mt-6 text-center text-gray-600">
          <p className="text-sm">
            Already have an account?{" "}
            <button
              onClick={() => router.push("/dk/partner")}
              className="text-gray-900 font-semibold hover:underline hover:text-gray-700 transition"
            >
              Sign In
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
