/**
 * Script để fix shipping profile cho các sản phẩm seller đã tạo
 */

const { Client } = require('pg');
require('dotenv').config();

async function fixShippingProfile() {
    const dbClient = new Client({ connectionString: process.env.DATABASE_URL });

    try {
        await dbClient.connect();
        console.log('Connected to database\n');

        // Get default shipping profile
        const profileResult = await dbClient.query(`
            SELECT id FROM shipping_profile 
            WHERE name = 'Default Shipping Profile' OR type = 'default'
            LIMIT 1
        `);

        if (profileResult.rows.length === 0) {
            console.error('No default shipping profile found!');
            return;
        }

        const shippingProfileId = profileResult.rows[0].id;
        console.log(`Found shipping profile: ${shippingProfileId}\n`);

        // Get all seller products without shipping profile
        const result = await dbClient.query(`
            SELECT p.id, p.title
            FROM product p
            WHERE p.metadata->>'seller_company_id' LIKE 'Shop_%'
            AND p.deleted_at IS NULL
            AND NOT EXISTS (
                SELECT 1 FROM product_shipping_profile psp 
                WHERE psp.product_id = p.id
            )
        `);

        console.log(`Found ${result.rows.length} products without shipping profile\n`);

        let fixed = 0;
        for (const product of result.rows) {
            await dbClient.query(
                `INSERT INTO product_shipping_profile (id, product_id, shipping_profile_id, created_at, updated_at) 
                 VALUES (gen_random_uuid(), $1, $2, NOW(), NOW()) 
                 ON CONFLICT (product_id, shipping_profile_id) DO NOTHING`,
                [product.id, shippingProfileId]
            );
            console.log(`Fixed: ${product.title}`);
            fixed++;
        }

        console.log(`\n${'='.repeat(60)}`);
        console.log(`Fixed ${fixed} products!`);
        console.log(`${'='.repeat(60)}\n`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await dbClient.end();
    }
}

fixShippingProfile();
