// my-medusa-store/src/api/store/market/products/list/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";
import jwt from "jsonwebtoken";
import { Client } from "pg";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
    const container = req.scope;
    const productModuleService = container.resolve(Modules.PRODUCT);
    const inventoryModule = container.resolve(Modules.INVENTORY);

    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: "No token" });

    const dbClient = new Client({ connectionString: process.env.DATABASE_URL });

    try {
        const token = authHeader.split(" ")[1];
        const decoded: any = jwt.verify(token, JWT_SECRET);
        const authId = decoded.sub || decoded.auth_identity_id;

        await dbClient.connect();

        // 1. Tìm User ID từ Auth ID
        const linkRes = await dbClient.query(
            `SELECT user_id FROM user_user_auth_auth_identity WHERE auth_identity_id = $1`,
            [authId]
        );

        if (linkRes.rows.length === 0) {
            return res.json({ products: [] });
        }

        // 2. [FIX QUAN TRỌNG]: Lấy Company Code từ bảng User
        // Bảng "user" dùng cột "metadata" (Đã fix từ user_metadata -> metadata)
        const userRes = await dbClient.query(
            `SELECT metadata FROM "user" WHERE id = $1`,
            [linkRes.rows[0].user_id]
        );

        // Kiểm tra kỹ xem có data không
        if (userRes.rows.length === 0) {
            return res.json({ products: [] });
        }

        const companyCode = userRes.rows[0]?.metadata?.company_code;

        console.log(`[List Product] Seller: ${companyCode}`);

        if (!companyCode) return res.json({ products: [] });

        // 3. Lấy sản phẩm và lọc
        // Sử dụng try-catch riêng cho đoạn này để bắt lỗi của Module Product
        try {
            const [allProducts, count] = await productModuleService.listAndCountProducts(
                {},
                {
                    relations: ["images", "variants", "options", "variants.options"],
                    take: 1000,
                    order: { created_at: "DESC" }
                }
            );

            // Lọc theo seller_company_id
            const sellerProducts = allProducts.filter(p => {
                return p.metadata?.seller_company_id === companyCode;
            });

            // Map products và tính inventory từ database
            const mappedProducts = await Promise.all(sellerProducts.map(async (p) => {
                // Tính tổng inventory từ tất cả variants qua database
                let totalInventory = 0;

                // Thêm inventory_quantity cho từng variant
                const variantsWithInventory = await Promise.all((p.variants || []).map(async (variant) => {
                    let variantInventory = 0;
                    try {
                        // Query trực tiếp database để lấy inventory
                        const invQuery = await dbClient.query(`
                    SELECT il.stocked_quantity
                    FROM inventory_level il
                    INNER JOIN product_variant_inventory_item pvii ON pvii.inventory_item_id = il.inventory_item_id
                    WHERE pvii.variant_id = $1
                `, [variant.id]);

                        if (invQuery.rows.length > 0) {
                            variantInventory = invQuery.rows.reduce((sum, row) => sum + (parseInt(row.stocked_quantity) || 0), 0);
                            totalInventory += variantInventory;
                        }
                    } catch (err) {
                        console.warn(`Failed to get inventory for variant ${variant.id}:`, err);
                    }

                    return {
                        ...variant,
                        inventory_quantity: variantInventory
                    };
                }));

                return {
                    ...p,
                    variants: variantsWithInventory,
                    // Ưu tiên lấy giá từ metadata (do ta lưu lúc tạo), fallback về 0
                    display_price: p.metadata?.custom_price || 0,
                    // Tổng inventory từ tất cả variants
                    display_inventory: totalInventory,
                    // Lấy ảnh đầu tiên làm thumbnail nếu thumbnail null
                    thumbnail: p.thumbnail || (p.images && p.images.length > 0 ? p.images[0].url : null)
                };
            }));

            console.log(`📸 Sample product images:`, mappedProducts[0]?.images);
            console.log(`Sample inventory:`, mappedProducts[0]?.display_inventory);
            console.log(`Sample variant inventory:`, mappedProducts[0]?.variants?.[0]?.inventory_quantity);

            res.json({ products: mappedProducts, count: mappedProducts.length });

        } catch (prodError: any) {
            console.error("Medusa Product Service Error:", prodError);
            throw new Error("Lỗi khi gọi Product Service: " + prodError.message);
        }

    } catch (error: any) {
        console.error("List Product Route Error:", error);
        // Trả về lỗi chi tiết để debug ở client (F12)
        res.status(500).json({ error: error.message, stack: error.stack });
    } finally {
        await dbClient.end();
    }
};