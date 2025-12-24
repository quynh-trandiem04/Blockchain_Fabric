import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";
import jwt from "jsonwebtoken";
import { Client } from "pg";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

export const PATCH = async (req: MedusaRequest, res: MedusaResponse) => {
    const { id } = req.params;
    const { status, is_archived, price, inventory, variant_id } = req.body as any;

    console.log(`\n[PATCH Product] ID: ${id}`);
    console.log(`Body:`, { status, is_archived, price, inventory, variant_id });

    const container = req.scope;
    const productModuleService = container.resolve(Modules.PRODUCT);
    const pricingModuleService = container.resolve(Modules.PRICING);
    const inventoryModule = container.resolve(Modules.INVENTORY);

    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: "No token provided" });

    const dbClient = new Client({ connectionString: process.env.DATABASE_URL });

    try {
        const token = authHeader.split(" ")[1];
        let decoded: any;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (e) {
            return res.status(401).json({ message: "Invalid token" });
        }

        const authId = decoded.sub || decoded.auth_identity_id;
        await dbClient.connect();

        // Verify product ownership
        const product = await productModuleService.retrieveProduct(id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        const linkRes = await dbClient.query(
            `SELECT user_id FROM user_user_auth_auth_identity WHERE auth_identity_id = $1`,
            [authId]
        );
        if (linkRes.rows.length === 0) {
            return res.status(403).json({ message: "User not found" });
        }

        const userRes = await dbClient.query(
            `SELECT metadata FROM "user" WHERE id = $1`,
            [linkRes.rows[0].user_id]
        );
        const companyCode = userRes.rows[0]?.metadata?.company_code;

        if (product.metadata?.seller_company_id !== companyCode) {
            return res.status(403).json({ message: "You don't own this product" });
        }

        // Prepare updates
        const updates: any = {};
        const metadataUpdates: any = { ...product.metadata };

        // Update status (published/draft)
        if (status !== undefined) {
            updates.status = status;
        }

        // Update archived status
        if (is_archived !== undefined) {
            metadataUpdates.is_archived = is_archived;
        }

        // Update price
        if (price !== undefined) {
            // Frontend gửi cents (ví dụ: 200 cents = $2)
            const priceCents = parseInt(price);

            console.log(`[Update Price] Received: ${priceCents} cents -> Storing in metadata and PriceSet`);

            // Lưu cents vào metadata
            metadataUpdates.custom_price = priceCents;

            const variants = await productModuleService.listProductVariants({ product_id: id });

            for (const variant of variants) {
                const priceSetLinks = await dbClient.query(
                    `SELECT price_set_id FROM product_variant_price_set WHERE variant_id = $1`,
                    [variant.id]
                );

                if (priceSetLinks.rows.length > 0) {
                    const priceSetId = priceSetLinks.rows[0].price_set_id;

                    // Lưu cents nguyên
                    const newPrices = [
                        { currency_code: "usd", amount: priceCents },
                        { currency_code: "eur", amount: priceCents },
                        { currency_code: "vnd", amount: priceCents * 250 },
                        { currency_code: "dkk", amount: priceCents * 0.07 }
                    ];

                    await pricingModuleService.updatePriceSets(priceSetId, {
                        prices: newPrices
                    });

                    console.log(`Updated price for variant ${variant.id}`);
                }
            }
        }

        // Update inventory
        if (inventory !== undefined) {
            console.log(`[Update Inventory] inventory=${inventory}, variant_id=${variant_id}`);

            if (variant_id) {
                // Update single variant
                console.log(`Updating single variant: ${variant_id}`);

                const invLinkResult = await dbClient.query(
                    `SELECT inventory_item_id FROM product_variant_inventory_item WHERE variant_id = $1`,
                    [variant_id]
                );

                console.log(`Inventory link result:`, invLinkResult.rows);

                if (invLinkResult.rows.length > 0) {
                    // Inventory item exists - UPDATE
                    const inventoryItemId = invLinkResult.rows[0].inventory_item_id;
                    console.log(`Found inventory_item_id: ${inventoryItemId}`);

                    const inventoryLevels = await inventoryModule.listInventoryLevels({
                        inventory_item_id: inventoryItemId
                    });

                    console.log(`Current inventory levels:`, inventoryLevels.map(l => ({
                        location: l.location_id,
                        current: l.stocked_quantity
                    })));

                    for (const level of inventoryLevels) {
                        console.log(`Updating level at location ${level.location_id}: ${level.stocked_quantity} -> ${parseInt(inventory)}`);

                        await inventoryModule.updateInventoryLevels([{
                            inventory_item_id: inventoryItemId,
                            location_id: level.location_id,
                            stocked_quantity: parseInt(inventory)
                        }]);

                        console.log(`Updated successfully`);
                    }

                    console.log(`Updated inventory for variant ${variant_id}: ${inventory}`);
                } else {
                    // Inventory item DOES NOT exist - CREATE NEW
                    console.log(`🆕 No inventory item found - Creating new one for variant ${variant_id}`);

                    const stockLocationModule = container.resolve(Modules.STOCK_LOCATION);
                    const remoteLink = container.resolve("remoteLink");

                    // Get variant SKU
                    const variant = await productModuleService.retrieveProductVariant(variant_id);
                    const sku = variant.sku || `inv-${variant_id}`;

                    // Create inventory item
                    const inventoryItem = await inventoryModule.createInventoryItems({ sku });
                    console.log(`Created inventory item: ${inventoryItem.id}`);

                    // Link variant to inventory item
                    await remoteLink.create([{
                        [Modules.PRODUCT]: { variant_id: variant_id },
                        [Modules.INVENTORY]: { inventory_item_id: inventoryItem.id }
                    }]);
                    console.log(`Linked variant to inventory item`);

                    // Get stock location
                    const stockLocations = await stockLocationModule.listStockLocations({}, { take: 1 });
                    const defaultLocation = stockLocations[0];

                    if (defaultLocation) {
                        // Create inventory level
                        await inventoryModule.createInventoryLevels({
                            inventory_item_id: inventoryItem.id,
                            location_id: defaultLocation.id,
                            stocked_quantity: parseInt(inventory)
                        });
                        console.log(`Created inventory level with quantity: ${inventory}`);
                    } else {
                        console.warn(`No stock location found`);
                    }
                }
            } else {
                // Update all variants
                const variants = await productModuleService.listProductVariants({ product_id: id });

                for (const variant of variants) {
                    const invLinkResult = await dbClient.query(
                        `SELECT inventory_item_id FROM product_variant_inventory_item WHERE variant_id = $1`,
                        [variant.id]
                    );

                    if (invLinkResult.rows.length > 0) {
                        const inventoryItemId = invLinkResult.rows[0].inventory_item_id;

                        const inventoryLevels = await inventoryModule.listInventoryLevels({
                            inventory_item_id: inventoryItemId
                        });

                        for (const level of inventoryLevels) {
                            await inventoryModule.updateInventoryLevels([{
                                inventory_item_id: inventoryItemId,
                                location_id: level.location_id,
                                stocked_quantity: parseInt(inventory)
                            }]);
                        }
                    }
                }
            }

            // CHECK TOTAL INVENTORY & AUTO UNPUBLISH IF = 0
            const variants = await productModuleService.listProductVariants({ product_id: id });
            let totalInventory = 0;

            for (const variant of variants) {
                const invLinkResult = await dbClient.query(
                    `SELECT inventory_item_id FROM product_variant_inventory_item WHERE variant_id = $1`,
                    [variant.id]
                );

                if (invLinkResult.rows.length > 0) {
                    const inventoryItemId = invLinkResult.rows[0].inventory_item_id;
                    const inventoryLevels = await inventoryModule.listInventoryLevels({
                        inventory_item_id: inventoryItemId
                    });

                    for (const level of inventoryLevels) {
                        totalInventory += level.stocked_quantity || 0;
                    }
                }
            }

            if (totalInventory === 0) {
                updates.status = 'draft';
                console.log(`Product ${id} auto-unpublished: Total inventory = 0`);
            }
        }

        if (Object.keys(metadataUpdates).length > 0) {
            updates.metadata = metadataUpdates;
        }

        if (Object.keys(updates).length > 0) {
            await productModuleService.updateProducts(id, updates);
        }

        res.json({
            message: "Product updated successfully",
            product_id: id,
            updates: updates
        });

    } catch (error: any) {
        console.error("Update Product Error:", error);
        res.status(500).json({
            message: "Error updating product",
            error: error.message
        });
    } finally {
        await dbClient.end();
    }
};
