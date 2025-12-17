// src/api/store/market/shipper/orders/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";

// Import FabricService
const FabricServiceClass = require("../../../../../services/fabric");

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const fabricService = new FabricServiceClass(req.scope);
  const orderModuleService = req.scope.resolve(Modules.ORDER);
  
  // 1. Resolve User Module để lấy thông tin Shipper đang login
  const userModuleService = req.scope.resolve(Modules.USER);

  try {
    // FIX LỖI SYNTAX: Ép kiểu (req as any) để truy cập auth_context
    const authContext = (req as any).auth_context;

    if (!authContext || !authContext.actor_id) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    // Lấy thông tin User chi tiết để lấy metadata
    const user = await userModuleService.retrieveUser(authContext.actor_id);
    
    // Lấy company_code (VD: "GHN", "J&T")
    const shipperCompanyID = user.metadata?.company_code as string;

    if (!shipperCompanyID) {
        return res.status(400).json({ message: "Account does not have a linked Company Code." });
    }

    console.log(`[Shipper API] Fetching orders for: ${shipperCompanyID}`);

    // 2. Gọi Service với tham số companyID vừa lấy được
    const fabricOrders = await fabricService.listShipperOrders(shipperCompanyID); 
    
    if (!fabricOrders || fabricOrders.length === 0) {
        return res.json({ orders: [] });
    }

    // 3. Lấy danh sách ID gốc
    const medusaOrderIds: string[] = [...new Set<string>(
        fabricOrders.map((o: any) => String(o.blockchain_id).split('_')[0])
    )];

    // 4. Query Medusa DB
    const medusaOrders = await orderModuleService.listOrders(
        { 
            id: medusaOrderIds 
        },
        {
            relations: [
                "items", 
                "shipping_address", 
                "payment_collections"
            ],
            select: [
                "id", 
                "display_id", 
                "created_at", 
                "email", 
                "total", 
                "currency_code", 
                "status", 
                "fulfillment_status"
            ],
            order: { created_at: "DESC" }
        }
    );

    // 5. Merge Data
    const mergedOrders = fabricOrders.map((fOrder: any) => {
        const originalId = String(fOrder.blockchain_id).split('_')[0];
        const mOrder = medusaOrders.find((m: any) => m.id === originalId) as any;

        if (!mOrder) return null; 

        return {
            ...fOrder, 
            email: mOrder.email,
            currency_code: mOrder.currency_code,
            total: mOrder.total,
            fulfillment_status: mOrder.fulfillment_status,
            payment_collections: mOrder.payment_collections || []
        };
    }).filter(Boolean);

    return res.json({ orders: mergedOrders });

  } catch (error: any) {
    console.error("[Shipper API] Error:", error);
    return res.status(500).json({ message: error.message });
  }
};