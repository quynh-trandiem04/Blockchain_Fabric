// src/api/store/fabric/orders/[id]/cancel/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";
import { Client } from "pg";

const FabricService = require("../../../../../../services/fabric");

/**
 * POST /store/fabric/orders/{id}/cancel
 * Customer hủy đơn hàng (chỉ khi status = CREATED hoặc PAID)
 * Tự động hoàn lại kho khi hủy thành công
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
    const { id } = req.params;
    const fabricService = new FabricService(req.scope);

    console.log(`[Customer API] Cancel Order called for: ${id}`);

    try {
        // 1. Gọi blockchain CancelOrder
        console.log(`   Calling blockchain CancelOrder...`);
        await fabricService.cancelOrder(id);
        console.log(`   Blockchain CancelOrder successful`);

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

            // Resolve modules
            const inventoryModule = req.scope.resolve(Modules.INVENTORY);
            const productModule = req.scope.resolve(Modules.PRODUCT);

            // HOÀN LẠI KHO (RESTORE = ADD back quantities)
            for (const item of lineItemsResult.rows) {
                const variantId = item.variant_id;
                const quantity = item.quantity;

                console.log(`   [CancelOrder] Restoring ${quantity} units to variant ${variantId}...`);

                try {
                    // Lấy inventory items cho variant này
                    const [inventoryItems] = await inventoryModule.listInventoryItems({
                        sku: variantId,
                    });

                    if (!inventoryItems || inventoryItems.length === 0) {
                        console.log(`   No inventory item found for variant ${variantId}`);
                        continue;
                    }

                    const inventoryItemId = inventoryItems[0].id;

                    // Lấy stock locations
                    const stockLocations = await inventoryModule.listInventoryLevels({
                        inventory_item_id: inventoryItemId,
                    });

                    if (!stockLocations || stockLocations.length === 0) {
                        console.log(`   No stock location found for inventory item ${inventoryItemId}`);
                        continue;
                    }

                    const locationId = stockLocations[0].location_id;

                    // CẬP NHẬT: ADD quantity (restore inventory)
                    await inventoryModule.adjustInventory(
                        inventoryItemId,
                        locationId,
                        quantity // Positive number = add back
                    );

                    console.log(`   Successfully restored ${quantity} units to variant ${variantId}`);

                    // Kiểm tra tổng inventory và auto-publish nếu > 0
                    const updatedLevels = await inventoryModule.listInventoryLevels({
                        inventory_item_id: inventoryItemId,
                    });

                    const totalInventory = updatedLevels.reduce(
                        (sum: number, level: any) => sum + (level.stocked_quantity || 0),
                        0
                    );

                    console.log(`   [CancelOrder] Total inventory after restore: ${totalInventory}`);

                    if (totalInventory > 0) {
                        // Lấy product từ variant
                        const variants = await productModule.listProductVariants({ id: variantId });
                        if (variants && variants.length > 0) {
                            const productId = variants[0].product_id;

                            // Auto-publish product
                            if (productId) {
                                console.log(`   [CancelOrder] Auto-publishing product ${productId} (inventory restored > 0)`);

                                await productModule.updateProducts(productId, {
                                    status: "published",
                                });

                                console.log(`   Product ${productId} published successfully`);
                            }
                        }
                    }
                } catch (error: any) {
                    console.error(`   Failed to restore inventory for variant ${variantId}:`, error.message);
                }
            }

            // Cập nhật metadata order
            const updateMetadataQuery = `
            UPDATE "order" 
            SET metadata = $1
            WHERE id = $2
        `;
            const updatedMetadata = {
                ...metadata,
                inventory_restored: true,
                cancelled_at: new Date().toISOString(),
            };

            await dbClient.query(updateMetadataQuery, [
                JSON.stringify(updatedMetadata),
                originalOrderId,
            ]);

            console.log(`   [CancelOrder] Updated order metadata with inventory_restored flag`);

            return res.json({
                success: true,
                message: "Đã hủy đơn hàng và hoàn lại kho thành công!",
            });
        } finally {
            await dbClient.end();
        }
    } catch (error: any) {
        console.error(`   [CancelOrder] Error:`, error.message);

        // Kiểm tra lỗi từ blockchain (smart contract)
        if (error.message?.includes("Only orders with status CREATED or PAID can be cancelled")) {
            return res.status(400).json({
                success: false,
                error: "Chỉ có thể hủy đơn hàng khi đơn chưa được giao cho shipper (status CREATED hoặc PAID)",
            });
        }

        return res.status(500).json({
            success: false,
            error: error.message || "Có lỗi xảy ra khi hủy đơn hàng",
        });
    }
};
