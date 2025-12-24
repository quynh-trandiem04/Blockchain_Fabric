// src/api/store/fabric/orders/[id]/ship/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";
import jwt from "jsonwebtoken";
import { Client } from "pg";

const FabricService = require("../../../../../../services/fabric");

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const ALLOWED_ROLES = ['shipperorgmsp'];

// --- POST HANDLER ---
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params;
  
  // 1. Khởi tạo Service với Scope
  const fabricService = new FabricService(req.scope);
  console.log(`[API] ShipOrder called for Order ID: ${id}`);
  try {
    // 2. Kiểm tra Token (Authentication)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized: Missing Token" });
    }

    const token = authHeader.split(" ")[1];
    let actorId = "";
    
    try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        actorId = decoded.actor_id || decoded.user_id;
    } catch (e) {
        return res.status(401).json({ message: "Unauthorized: Invalid Token" });
    }

    if (!actorId) return res.status(401).json({ message: "Unauthorized: No Actor ID" });

    // 3. Lấy thông tin User từ Database Medusa
    const userModuleService = req.scope.resolve(Modules.USER);
    const user = await userModuleService.retrieveUser(actorId, { 
        select: ["id", "metadata", "email"] 
    });

    const role = (user.metadata?.fabric_role as string || "").toLowerCase();
    const companyCode = user.metadata?.company_code as string;

    // 4. Kiểm tra Quyền (Authorization)
    if (!ALLOWED_ROLES.includes(role)) {
        return res.status(403).json({ message: "Forbidden: Chỉ tài khoản Shipper mới được quyền giao hàng." });
    }
    
    if (!companyCode) {
        return res.status(400).json({ message: "Lỗi dữ liệu: Tài khoản Shipper này chưa có mã công ty (company_code)." });
    }

    // 5. Gọi Blockchain
    console.log(`[API] Processing ShipOrder for ${id}`);
    console.log(`      -> Actor: ${user.email}`);
    console.log(`      -> Verification Company Code: ${companyCode}`);

    await fabricService.shipOrder(id, companyCode);

    // 6. TRỪ KHO TỰ ĐỘNG sau khi ship thành công
    const dbClient = new Client({ connectionString: process.env.DATABASE_URL });

    try {
      await dbClient.connect();

      // Extract original order ID (remove _1, _2 suffix for split orders)
      const originalOrderId = id.includes('_') ? id.substring(0, id.lastIndexOf('_')) : id;
      console.log(`[ShipOrder] Original Order ID: ${originalOrderId} (from ${id})`);

      // Lấy thông tin order
      const orderQuery = `SELECT id, metadata FROM "order" WHERE id = $1`;
      const orderResult = await dbClient.query(orderQuery, [originalOrderId]);

      if (orderResult.rows.length === 0) {
        console.log(`[ShipOrder] Order ${originalOrderId} not found in database`);
        return res.json({
          success: true,
          message: "Đã xác nhận lấy hàng thành công (Shipped)!",
        });
      }

      console.log(`[ShipOrder] Found order in database: ${originalOrderId}`);

      const order = orderResult.rows[0];
      const metadata = order.metadata || {};

      // Kiểm tra xem đã trừ kho chưa
      if (metadata.inventory_reduced) {
        console.log(`[ShipOrder] Inventory already reduced for order ${id}`);
        return res.json({
          success: true,
          message: "Đã xác nhận lấy hàng thành công (Shipped)!",
        });
      }

      // Lấy line items
      const lineItemsQuery = `
            SELECT oli.id, oli.variant_id, oli.title, oi.quantity
            FROM order_line_item oli
            JOIN order_item oi ON oli.id = oi.item_id
            WHERE oi.order_id = $1
        `;
      const lineItemsResult = await dbClient.query(lineItemsQuery, [originalOrderId]);

      if (lineItemsResult.rows.length === 0) {
        console.log(`[ShipOrder] No line items found for order ${originalOrderId}`);
        return res.json({
          success: true,
          message: "Đã xác nhận lấy hàng thành công (Shipped)!",
        });
      }

      console.log(`[ShipOrder] Found ${lineItemsResult.rows.length} line items`);

      const inventoryModule = req.scope.resolve(Modules.INVENTORY);
      const productModule = req.scope.resolve(Modules.PRODUCT);
      const productsToCheck = new Set<string>();

      // Trừ inventory cho từng variant
      for (const item of lineItemsResult.rows) {
        const { variant_id, quantity, title } = item;

        try {
          const inventoryLinkQuery = `
                    SELECT inventory_item_id
                    FROM product_variant_inventory_item
                    WHERE variant_id = $1
                `;
          const inventoryLinkResult = await dbClient.query(inventoryLinkQuery, [variant_id]);

          if (inventoryLinkResult.rows.length === 0) {
            console.log(`No inventory item for variant ${variant_id}`);
            continue;
          }

          const inventoryItemId = inventoryLinkResult.rows[0].inventory_item_id;

          // Get product_id
          const productQuery = `SELECT product_id FROM product_variant WHERE id = $1`;
          const productResult = await dbClient.query(productQuery, [variant_id]);
          if (productResult.rows.length > 0) {
            productsToCheck.add(productResult.rows[0].product_id);
          }

          // Lấy inventory levels
          const inventoryLevels = await inventoryModule.listInventoryLevels({
            inventory_item_id: inventoryItemId
          });

          // Trừ inventory
          for (const level of inventoryLevels) {
            const currentStock = level.stocked_quantity || 0;
            const newStock = Math.max(0, currentStock - quantity);

            await inventoryModule.updateInventoryLevels([{
              inventory_item_id: inventoryItemId,
              location_id: level.location_id,
              stocked_quantity: newStock
            }]);

            console.log(`Reduced inventory for ${title}: ${currentStock} → ${newStock} (Qty: -${quantity})`);
          }

        } catch (invError: any) {
          console.error(`Failed to reduce inventory for variant ${variant_id}:`, invError.message);
        }
      }

      // Kiểm tra và auto-unpublish nếu tổng kho = 0
      for (const productId of productsToCheck) {
        try {
          const variantsQuery = `
                    SELECT pv.id
                    FROM product_variant pv
                    WHERE pv.product_id = $1 AND pv.deleted_at IS NULL
                `;
          const variantsResult = await dbClient.query(variantsQuery, [productId]);

          let totalInventory = 0;

          for (const variant of variantsResult.rows) {
            const inventoryLinkQuery = `
                        SELECT inventory_item_id
                        FROM product_variant_inventory_item
                        WHERE variant_id = $1
                    `;
            const inventoryLinkResult = await dbClient.query(inventoryLinkQuery, [variant.id]);

            if (inventoryLinkResult.rows.length > 0) {
              const inventoryItemId = inventoryLinkResult.rows[0].inventory_item_id;
              const inventoryLevels = await inventoryModule.listInventoryLevels({
                inventory_item_id: inventoryItemId
              });

              for (const level of inventoryLevels) {
                totalInventory += level.stocked_quantity || 0;
              }
            }
          }

          if (totalInventory === 0) {
            await productModule.updateProducts(productId, {
              status: 'draft'
            });

            console.log(`Product ${productId} auto-unpublished: Total inventory = 0`);
          }

        } catch (productError: any) {
          console.error(`Failed to check/update product ${productId}:`, productError.message);
        }
      }

      // Đánh dấu đã trừ kho
      const updateMetadataQuery = `
            UPDATE "order"
            SET metadata = metadata || '{"inventory_reduced": true}'::jsonb
            WHERE id = $1
        `;
      await dbClient.query(updateMetadataQuery, [originalOrderId]);

      console.log(`[ShipOrder] Completed reducing inventory for order ${originalOrderId}`);

    } catch (error: any) {
      console.error(`[ShipOrder] Inventory reduction error:`, error.message);
    } finally {
      await dbClient.end();
    }

    return res.json({
      success: true,
      message: "Đã xác nhận lấy hàng thành công (Shipped)!",
    });

  } catch (error: any) {
    console.error("SHIP ORDER ERROR:", error);
    
    // Xử lý lỗi trả về từ Fabric để hiển thị rõ ràng hơn cho Frontend
    const errorMessage = error.message || "Lỗi hệ thống khi giao hàng.";
    
    return res.status(500).json({ 
        message: errorMessage,
        details: error.responses ? error.responses : undefined
    });
  }
};

// --- OPTIONS HANDLER (FIX CORS & TYPESCRIPT) ---
export async function OPTIONS(req: MedusaRequest, res: MedusaResponse) {
  // Lấy origin từ request header để trả về chính xác
  // Ép kiểu (as string) để tránh lỗi TypeScript: "Type 'string | string[]' is not assignable..."
  const origin = (req.headers["origin"] as string) || "*";

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-publishable-api-key, X-Requested-With",
      "Access-Control-Allow-Credentials": "true", 
    },
  });
}