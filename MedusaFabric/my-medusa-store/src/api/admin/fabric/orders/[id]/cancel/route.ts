// src/api/admin/fabric/orders/[id]/cancel/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";
import { Client } from "pg";

const FabricService = require("../../../../../../services/fabric");

/**
 * POST /admin/fabric/orders/{id}/cancel
 * Admin hủy đơn hàng (chỉ khi status = CREATED hoặc PAID)
 * Tự động hoàn lại kho khi hủy thành công
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
    const { id } = req.params;
    const fabricService = new FabricService(req.scope);

    console.log(`[Admin API] Cancel Order called for: ${id}`);

    try {
        // 1. Gọi blockchain CancelOrder
        console.log(`[Admin API] Calling blockchain CancelOrder...`);
        await fabricService.cancelOrder(id);
        console.log(`[Admin API] Blockchain CancelOrder successful`);

        // 2. HOÀN LẠI KHO tự động
        const dbClient = new Client({ connectionString: process.env.DATABASE_URL });

        try {
            await dbClient.connect();

            // Extract original order ID (remove _1, _2 suffix for split orders)
            const originalOrderId = id.includes('_') ? id.substring(0, id.lastIndexOf('_')) : id;
            console.log(`   [CancelOrder] Original Order ID: ${originalOrderId} (from ${id})`);

            // Lấy thông tin order
            const orderQuery = `SELECT id, metadata FROM "order" WHERE id = $1`;
            const orderResult = await dbClient.query(orderQuery, [originalOrderId]);

            if (orderResult.rows.length === 0) {
                console.log(`   [CancelOrder] Order ${originalOrderId} not found in database`);
                return res.json({
                    success: true,
                    message: "Đã hủy đơn hàng thành công!",
                });
            }

            const order = orderResult.rows[0];
            const metadata = order.metadata || {};

            console.log(`   [CancelOrder] Found order in database: ${originalOrderId}`);
            console.log(`   Metadata inventory_reduced: ${metadata.inventory_reduced}`);

            // Chỉ hoàn kho nếu đơn đã trừ kho trước đó
            if (!metadata.inventory_reduced) {
                console.log(`   [CancelOrder] Order was not shipped yet, no inventory to restore`);
                return res.json({
                    success: true,
                    message: "Đã hủy đơn hàng thành công!",
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
                console.log(`   [CancelOrder] No line items found for order ${originalOrderId}`);
                return res.json({
                    success: true,
                    message: "Đã hủy đơn hàng thành công!",
                });
            }

            console.log(`   [CancelOrder] Found ${lineItemsResult.rows.length} line items, restoring inventory...`);

            const inventoryModule = req.scope.resolve(Modules.INVENTORY);
            const productModule = req.scope.resolve(Modules.PRODUCT);
            const productsToCheck = new Set<string>();

            // Hoàn lại inventory cho từng variant
            for (const item of lineItemsResult.rows) {
                const { variant_id, quantity, title } = item;

                console.log(`\n   Restoring item: ${title}`);
                console.log(`      Variant ID: ${variant_id}`);
                console.log(`      Quantity to restore: +${quantity}`);

                try {
                    const inventoryLinkQuery = `
                    SELECT inventory_item_id
                    FROM product_variant_inventory_item
                    WHERE variant_id = $1
                `;
                    const inventoryLinkResult = await dbClient.query(inventoryLinkQuery, [variant_id]);

                    if (inventoryLinkResult.rows.length === 0) {
                        console.log(`      No inventory item for variant ${variant_id}`);
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

                    // HOÀN LẠI inventory (cộng)
                    for (const level of inventoryLevels) {
                        const currentStock = level.stocked_quantity || 0;
                        const newStock = currentStock + quantity; // CỘNG lại

                        await inventoryModule.updateInventoryLevels([{
                            inventory_item_id: inventoryItemId,
                            location_id: level.location_id,
                            stocked_quantity: newStock
                        }]);

                        console.log(`      Restored inventory for ${title}: ${currentStock} -> ${newStock} (Qty: +${quantity})`);
                    }

                } catch (invError: any) {
                    console.error(`      Failed to restore inventory for variant ${variant_id}:`, invError.message);
                }
            }

            // Kiểm tra và auto-publish lại nếu có hàng
            for (const productId of productsToCheck) {
                try {
                    if (!productId) continue;

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

                    // Nếu có hàng và đang draft → publish lại
                    const productQuery = `SELECT status FROM product WHERE id = $1`;
                    const productResult = await dbClient.query(productQuery, [productId]);

                    if (productResult.rows.length > 0 && productResult.rows[0].status === 'draft' && totalInventory > 0) {
                        await productModule.updateProducts(productId, {
                            status: 'published'
                        });

                        console.log(`   Product ${productId} auto-published: Total inventory = ${totalInventory}`);
                    }

                } catch (productError: any) {
                    console.error(`   Failed to check/update product ${productId}:`, productError.message);
                }
            }

            // Cập nhật metadata: đánh dấu đã hoàn kho
            const updateMetadataQuery = `
            UPDATE "order"
            SET metadata = metadata || '{"inventory_restored": true}'::jsonb
            WHERE id = $1
        `;
            await dbClient.query(updateMetadataQuery, [originalOrderId]);

            console.log(`   [CancelOrder] Completed restoring inventory for order ${originalOrderId}`);

        } catch (error: any) {
            console.error(`   [CancelOrder] Inventory restoration error:`, error.message);
        } finally {
            await dbClient.end();
        }

        return res.json({
            success: true,
            message: "Đã hủy đơn hàng và hoàn lại kho thành công!",
        });

    } catch (error: any) {
        console.error("CANCEL ORDER ERROR:", error);

        const errorMessage = error.message || "Lỗi hệ thống khi hủy đơn hàng.";

        return res.status(500).json({
            message: errorMessage,
            details: error.responses ? error.responses : undefined
        });
    }
};
