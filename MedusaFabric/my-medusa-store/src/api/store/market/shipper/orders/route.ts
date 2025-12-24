// src/api/store/market/shipper/orders/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";
import jwt from "jsonwebtoken"; 
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Import FabricService
const FabricServiceClass = require("../../../../../services/fabric");

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const fabricService = new FabricServiceClass(req.scope);
  const orderModuleService = req.scope.resolve(Modules.ORDER);
  const userModuleService = req.scope.resolve(Modules.USER);

  console.log("========================================");
    console.log("[Shipper API] GET /store/market/shipper/orders called");

  try {
    // 1. TỰ XÁC THỰC TOKEN
    let actorId = (req as any).auth_context?.actor_id;

    if (!actorId) {
        const authHeader = req.headers.authorization || req.headers.Authorization as string;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.split(" ")[1];
            try {
                const decoded: any = jwt.decode(token); 
                if (decoded && decoded.actor_id) actorId = decoded.actor_id;
                            } catch (e) { console.error("Token error", e); }
        }
    }

    if (!actorId) return res.status(401).json({ message: "Unauthorized" });

    // 2. Lấy thông tin User & Company Code
    const user = await userModuleService.retrieveUser(actorId);
    const shipperCompanyID = user.metadata?.company_code as string;
    
        console.log(`User: ${user.email} | Filtering for: ${shipperCompanyID}`);

    if (!shipperCompanyID) {
        return res.status(400).json({ message: "Account does not have a linked Company Code." });
    }

    // 3. Gọi Service Fabric
    const fabricOrders = await fabricService.listShipperOrders(shipperCompanyID); 
        console.log(`[Fabric] Found ${fabricOrders.length} split orders on Blockchain`);
    
    if (!fabricOrders || fabricOrders.length === 0) {
        return res.json({ orders: [] });
    }

    // 4. Lấy danh sách ID gốc (FIX BUG TẠI ĐÂY)
    const medusaOrderIds: string[] = [...new Set<string>(
        fabricOrders.map((o: any) => String(o.blockchain_id).replace(/_\d+$/, ''))
    )];
    
        console.log(`[Debug] Original DB IDs to query:`, medusaOrderIds);

    // 5. Query Medusa DB
    const medusaOrders = await orderModuleService.listOrders(
        { id: medusaOrderIds },
        {
            relations: ["items", "shipping_address"], // Bỏ payment_collections để tránh lỗi ORM
            select: ["id", "display_id", "created_at", "email", "total", "currency_code", "status", "fulfillment_status"],
            order: { created_at: "DESC" }
        }
    );
    
        console.log(`[DB] Found ${medusaOrders.length} matching original orders`);

    // 6. Merge Data
    const mergedOrders = fabricOrders.map((fOrder: any) => {
        // Tìm đơn gốc tương ứng
        const originalId = String(fOrder.blockchain_id).replace(/_\d+$/, '');
        const mOrder = medusaOrders.find((m: any) => m.id === originalId) as any;

        // Nếu DB không thấy, vẫn trả về data blockchain để Shipper biết
        if (!mOrder) {
                        return {
                ...fOrder, // Giữ nguyên ID blockchain (VD: order_..._1)
                email: "N/A",
                currency_code: "USD",
                total: 0,
                fulfillment_status: "unknown",
                payment_collections: []
            };
        }

        return {
            ...fOrder, // Giữ nguyên ID blockchain (VD: order_..._1)
            
            // Chỉ lấy thông tin phụ trợ từ DB 
            email: mOrder.email,
            currency_code: mOrder.currency_code,
            total: mOrder.total,
            fulfillment_status: mOrder.fulfillment_status,
            payment_collections: []
        };
    });

        console.log(`[Final] Returning ${mergedOrders.length} orders to UI`);

    return res.json({ orders: mergedOrders });

  } catch (error: any) {
        console.error("[Shipper API] Error:", error);
    return res.status(500).json({ message: error.message });
  }
};