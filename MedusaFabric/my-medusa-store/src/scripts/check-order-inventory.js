// Script kiểm tra xem đơn hàng đã trừ kho chưa
const { Client } = require('pg');

const ORDER_ID = 'order_01KD2GSR6BDESCH31HQADZ24Y6_1';

async function main() {
    const dbClient = new Client({ connectionString: process.env.DATABASE_URL });

    try {
        await dbClient.connect();

        // 1. Kiểm tra order metadata
        const orderQuery = `SELECT id, metadata FROM "order" WHERE id = $1`;
        const orderResult = await dbClient.query(orderQuery, [ORDER_ID]);

        if (orderResult.rows.length === 0) {
            console.log(`Order ${ORDER_ID} not found`);
            return;
        }

        const order = orderResult.rows[0];
        console.log(`\nOrder: ${ORDER_ID}`);
        console.log(`   Metadata:`, JSON.stringify(order.metadata, null, 2));
        console.log(`   Inventory Reduced: ${order.metadata?.inventory_reduced ? 'YES' : 'NO'}`);

        // 2. Lấy line items
        const lineItemsQuery = `
            SELECT oli.id, oli.variant_id, oli.title, oi.quantity
            FROM order_line_item oli
            JOIN order_item oi ON oli.id = oi.item_id
            WHERE oi.order_id = $1
        `;
        const lineItemsResult = await dbClient.query(lineItemsQuery, [ORDER_ID]);

        console.log(`\nLine Items:`);
        for (const item of lineItemsResult.rows) {
            console.log(`   - ${item.title} (Qty: ${item.quantity})`);
            console.log(`     Variant ID: ${item.variant_id}`);

            // Kiểm tra inventory hiện tại
            const invQuery = `
                SELECT il.stocked_quantity, sl.name as location_name
                FROM product_variant_inventory_item pvii
                JOIN inventory_level il ON pvii.inventory_item_id = il.inventory_item_id
                JOIN stock_location sl ON il.location_id = sl.id
                WHERE pvii.variant_id = $1
            `;
            const invResult = await dbClient.query(invQuery, [item.variant_id]);

            if (invResult.rows.length > 0) {
                console.log(`     Current Stock: ${invResult.rows[0].stocked_quantity} (${invResult.rows[0].location_name})`);
            } else {
                console.log(`     No inventory found`);
            }
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await dbClient.end();
    }
}

main();
