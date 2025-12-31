import axios from "axios"

class TaxBlockchainService {
  constructor() {}

  async getTaxData() {
    try {
      const response = await axios.get("http://192.168.245.11:3333/api/tax/summary")
      return response.data
    } catch (error) {
      console.error("Lỗi kết nối API Thuế:", error.message)
      throw new Error("Không thể lấy dữ liệu từ máy Ubuntu")
    }
  }
}

export default TaxBlockchainService