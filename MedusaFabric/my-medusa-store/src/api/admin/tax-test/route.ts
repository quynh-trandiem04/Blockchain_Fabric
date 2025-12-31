import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  // Giải quyết service từ container
  const taxService = req.scope.resolve("taxBlockchainService") as any
  
  try {
    const data = await taxService.getTaxData()
    res.json({
      success: true,
      message: "Dữ liệu lấy trực tiếp từ Blockchain Ubuntu",
      payload: data
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}