import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";
import { Client } from "pg";

/**
 * Subscriber để TRỪ TỒN KHO TỰ ĐỘNG khi order chuyển sang DELIVERED
 * Áp dụng cho cả COD và PREPAID
 */
export default async function reduceInventoryOnDeliveredHandler({
    event,
    container,
}: SubscriberArgs<any>) {
    console.log(`\n[Inventory Subscriber] Handler called!`);
    console.log(`   Event name: ${event.name}`);
    console.log(`   Event data:`, JSON.stringify(event.data, null, 2));

    const eventData = event.data;
    const orderId = eventData?.orderId || eventData?.order_id;

    console.log(`   Extracted orderId: ${orderId}`);

    if (!orderId) {
        console.log("   No orderId in event data - EXITING");
        return;
    }

    const dbClient = new Client({ connectionString: process.env.DATABASE_URL });

    try {
        await dbClient.connect();

        // 1. Get order info
        const orderQuery = `
            SELECT id, metadata, status
            FROM "order"
            WHERE id = $1
        `;
        const orderResult = await dbClient.query(orderQuery, [orderId]);

        if (orderResult.rows.length === 0) {
            console.log(`[Inventory Subscriber] Order ${orderId} not found`);
            return;
        }

        const order = orderResult.rows[0];
        const metadata = order.metadata || {};
        const blockchainStatus = eventData.newStatus || eventData.status;

        console.log(`   Order Status from DB: ${order.status}`);
        console.log(`   Blockchain Status: ${blockchainStatus}`);
        console.log(`   Metadata:`, metadata);
        console.log(`   Inventory Reduced Flag: ${metadata.inventory_reduced}`);

        // 2. Check if should reduce inventory - KHI SHIPPED (hỗ trợ cả chữ hoa và chữ thường)
        const shouldReduceInventory = blockchainStatus?.toUpperCase() === 'SHIPPED';

        console.log(`   🔍 Status check: '${blockchainStatus}' → shouldReduce: ${shouldReduceInventory}`);

        if (!shouldReduceInventory) {
            console.log(`   ⏭️ Skipping - Status: ${blockchainStatus} (waiting for SHIPPED)`);
            return;
        }

        // 3. Check if already reduced
        if (metadata.inventory_reduced) {
            console.log(`   Already reduced for order ${orderId} - EXITING`);
            return;
        }

        console.log(`   Passed all checks - proceeding with inventory reduction...`);

        // 4. Get line items
        const lineItemsQuery = `
            SELECT oli.id, oli.variant_id, oli.title, oi.quantity
            FROM order_line_item oli
            JOIN order_item oi ON oli.id = oi.item_id
            WHERE oi.order_id = $1
        `;
        const lineItemsResult = await dbClient.query(lineItemsQuery, [orderId]);

        if (lineItemsResult.rows.length === 0) {
            console.log(`[Inventory Subscriber] No line items found for order ${orderId}`);
            return;
        }

        const inventoryModule = container.resolve(Modules.INVENTORY);
        const productModule = container.resolve(Modules.PRODUCT);

        // Track products that need status check
        const productsToCheck = new Set<string>();

        // 5. Reduce inventory for each variant
        console.log(`   Processing ${lineItemsResult.rows.length} line items...`);

        for (const item of lineItemsResult.rows) {
            const { variant_id, quantity, title } = item;

            console.log(`\n   Processing item: ${title}`);
            console.log(`      Variant ID: ${variant_id}`);
            console.log(`      Quantity to reduce: ${quantity}`);

            try {
                // Lấy inventory_item_id từ variant
                const inventoryLinkQuery = `
                    SELECT inventory_item_id
                    FROM product_variant_inventory_item
                    WHERE variant_id = $1
                `;
                const inventoryLinkResult = await dbClient.query(inventoryLinkQuery, [variant_id]);
                console.log(`      🔍 Found ${inventoryLinkResult.rows.length} inventory links`);

                if (inventoryLinkResult.rows.length === 0) {
                    console.log(`No inventory item for variant ${variant_id}`);
                    continue;
                }

                const inventoryItemId = inventoryLinkResult.rows[0].inventory_item_id;

                // Get product_id for this variant
                const productQuery = `
                    SELECT product_id
                    FROM product_variant
                    WHERE id = $1
                `;
                const productResult = await dbClient.query(productQuery, [variant_id]);
                if (productResult.rows.length > 0) {
                    productsToCheck.add(productResult.rows[0].product_id);
                }

                // Lấy tất cả inventory levels cho item này
                const inventoryLevels = await inventoryModule.listInventoryLevels({
                    inventory_item_id: inventoryItemId
                });

                // Trừ inventory ở mỗi location
                for (const level of inventoryLevels) {
                    const currentStock = level.stocked_quantity || 0;
                    const newStock = Math.max(0, currentStock - quantity);

                    await inventoryModule.updateInventoryLevels([{
                        inventory_item_id: inventoryItemId,
                        location_id: level.location_id,
                        stocked_quantity: newStock
                    }]);

                    console.log(`Reduced inventory for ${title}: ${currentStock} -> ${newStock} (Qty: -${quantity})`);
                }

            } catch (invError: any) {
                console.error(`Failed to reduce inventory for variant ${variant_id}:`, invError.message);
            }
        }

        // 6. Check and update product status if total inventory = 0
        for (const productId of productsToCheck) {
            try {
                // Get all variants for this product
                const variantsQuery = `
                    SELECT pv.id
                    FROM product_variant pv
                    WHERE pv.product_id = $1 AND pv.deleted_at IS NULL
                `;
                const variantsResult = await dbClient.query(variantsQuery, [productId]);

                let totalInventory = 0;

                // Calculate total inventory across all variants
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

                // If total inventory = 0, set product to draft
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

        // 7. Mark as reduced in order metadata
        const updateMetadataQuery = `
            UPDATE "order"
            SET metadata = metadata || '{"inventory_reduced": true}'::jsonb
            WHERE id = $1
        `;
        await dbClient.query(updateMetadataQuery, [orderId]);

        console.log(`[Inventory Subscriber] Completed reducing inventory for order ${orderId}`);

    } catch (error: any) {
        console.error(`[Inventory Subscriber] Error:`, error.message);
    } finally {
        await dbClient.end();
    }
}

export const config: SubscriberConfig = {
    event: "blockchain.order.status.changed",
};
