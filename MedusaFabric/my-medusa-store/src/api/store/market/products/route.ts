import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";
import jwt from "jsonwebtoken";
import { Client } from "pg"; 

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

function slugify(text: string) {
  return text.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-").replace(/[^\w-]+/g, "").replace(/--+/g, "-").replace(/^-+/, "").replace(/-+$/, "");
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { title, subtitle, description, handle, price, inventory_quantity, images, options, variants } = req.body as any;
  
  const container = req.scope;
  const productModuleService = container.resolve(Modules.PRODUCT);
  const pricingModuleService = container.resolve(Modules.PRICING); // <--- MỚI: Gọi Pricing Module
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL);
  const remoteLink = container.resolve("remoteLink");
  const marketplaceService = container.resolve("marketplace") as any;

  // Check Token
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "No token provided" });

  const dbClient = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    const token = authHeader.split(" ")[1];
    let decoded: any;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return res.status(401).json({ message: "Token expired or invalid" });
    }
    const authId = decoded.sub || decoded.auth_identity_id;

    await dbClient.connect();
    
    // 1. Check User & Shop
    const linkRes = await dbClient.query(
        `SELECT user_id FROM link_user_auth_identity WHERE auth_identity_id = $1 UNION ALL SELECT user_id FROM user_user_auth_auth_identity WHERE auth_identity_id = $1`,
        [authId]
    );
    if (linkRes.rows.length === 0) throw new Error("User not linked");
    const userId = linkRes.rows[0].user_id;
    const userRes = await dbClient.query(`SELECT metadata FROM "user" WHERE id = $1`, [userId]);
    const companyCode = userRes.rows[0]?.metadata?.company_code;

    // 2. Sales Channel
    let defaultSalesChannelId: string | undefined;
    let [salesChannels] = await salesChannelService.listSalesChannels({ name: "Default Sales Channel" }, { take: 1 });
    if (!salesChannels) [salesChannels] = await salesChannelService.listSalesChannels({}, { take: 1 });
    defaultSalesChannelId = salesChannels?.id;

    // 3. Chuẩn bị dữ liệu cơ bản
    const uniqueSuffix = Date.now().toString().slice(-6);
    const safeHandle = `${(handle ? slugify(handle) : slugify(title))}-${uniqueSuffix}`;
    const basePrice = parseInt(price);
    
    // --- CHUẨN BỊ GIÁ (Để dùng ở bước sau) ---
    const pricesData = [
        { currency_code: "usd", amount: basePrice },
        { currency_code: "eur", amount: basePrice },        
        { currency_code: "vnd", amount: basePrice * 25000 },
        { currency_code: "dkk", amount: basePrice * 7 } // Quan trọng cho Region Đan Mạch
    ];

    // --- BƯỚC 1: CHUẨN BỊ OPTIONS & VARIANTS PAYLOAD ---
    const optionsCollector = new Map<string, Set<string>>();

    const collectValue = (optTitle: string, val: any) => {
        if (!optTitle) return;
        const cleanTitle = optTitle.trim();
        if (cleanTitle === "") return;
        if (!optionsCollector.has(cleanTitle)) optionsCollector.set(cleanTitle, new Set());
        if (val && typeof val === 'string' && val.trim() !== "") {
            optionsCollector.get(cleanTitle)?.add(val.trim());
        }
    };

    if (options && Array.isArray(options)) {
        options.forEach((o: any) => {
            if(o.title && o.title.trim() !== "") {
                if(!optionsCollector.has(o.title.trim())) optionsCollector.set(o.title.trim(), new Set());
                if (Array.isArray(o.values)) o.values.forEach((v: string) => collectValue(o.title, v));
            }
        });
    }

    if (variants && Array.isArray(variants)) {
        variants.forEach((v: any) => {
            if (v.options) Object.entries(v.options).forEach(([key, val]) => collectValue(key, val));
        });
    }

    let isDefaultVariant = false;
    if (optionsCollector.size === 0) {
        optionsCollector.set("Default Option", new Set(["Default"]));
        isDefaultVariant = true;
    }

    const optionsPayload = Array.from(optionsCollector.entries()).map(([title, valuesSet]) => ({
        title: title,
        values: Array.from(valuesSet) 
    }));

    // Chuẩn bị Variant Payload (Lưu ý: KHÔNG truyền prices vào đây nữa)
    let variantsPayload: any[] = [];
    if (!isDefaultVariant && variants && variants.length > 0) {
        variantsPayload = variants.map((v: any) => {
            const cleanOptions: Record<string, string> = {};
            if(v.options) {
                Object.entries(v.options).forEach(([key, val]) => {
                    if(key.trim()) cleanOptions[key.trim()] = (val as string).trim();
                });
            }
            return {
                title: v.title,
                sku: v.sku || `${companyCode}-${slugify(v.title)}-${uniqueSuffix}-${Math.random().toString(36).substr(2,4)}`,
                options: cleanOptions, 
                manage_inventory: false,
                allow_backorder: true,
                // prices: pricesData <-- XÓA DÒNG NÀY ĐỂ TRÁNH NHẦM LẪN
                inventory_quantity: parseInt(inventory_quantity) || 10
            };
        });
    } else {
        variantsPayload = [{
            title: "Default Variant",
            sku: `${companyCode}-default-${uniqueSuffix}`,
            options: { "Default Option": "Default" },
            manage_inventory: false,
            allow_backorder: true,
            inventory_quantity: parseInt(inventory_quantity) || 10
        }];
    }

    // --- BƯỚC 2: TẠO SẢN PHẨM & VARIANTS ---
    console.log(">>> Creating Product & Variants...");
    const product = await productModuleService.createProducts({
        title,
        subtitle,
        description,
        handle: safeHandle,
        status: "published",
        images: images || [],
        options: optionsPayload,
        variants: variantsPayload, 
        metadata: {
            seller_company_id: companyCode,
            seller_user_id: userId,
            custom_price: basePrice
        }
    });

    // --- BƯỚC 3: TẠO GIÁ (PRICING MODULE) & LINK VỚI VARIANTS ---
    console.log(">>> Creating Prices & Links...");
    
    // Lấy danh sách variants vừa tạo ra từ DB để có ID chính xác
    const createdVariants = await productModuleService.listProductVariants({ product_id: product.id });
    
    const linksToCreate: any[] = [];

    for (const variant of createdVariants) {
        // A. Tạo Price Set cho từng Variant
        const priceSet = await pricingModuleService.createPriceSets({
            prices: pricesData // [USD, EUR, VND, DKK]
        });

        // B. Chuẩn bị Link: Product Variant <-> Price Set
        linksToCreate.push({
            [Modules.PRODUCT]: { variant_id: variant.id },
            [Modules.PRICING]: { price_set_id: priceSet.id }
        });
    }

    // C. Thực thi Link
    if (linksToCreate.length > 0) {
        await remoteLink.create(linksToCreate);
        console.log(`>>> Linked ${linksToCreate.length} variants to prices.`);
    }

    // 4. Link Sales Channel
    if (defaultSalesChannelId) {
        await remoteLink.create([
            {
                [Modules.PRODUCT]: { product_id: product.id },
                [Modules.SALES_CHANNEL]: { sales_channel_id: defaultSalesChannelId }
            }
        ]);
    }
    
    // 5. Link Marketplace
    try {
        const sellers = await marketplaceService.listSellers({ company_code: companyCode });
        if (sellers.length > 0) {
             await remoteLink.create([{
                [Modules.PRODUCT]: { product_id: product.id },
                "marketplace": { seller_id: sellers[0].id }
            }]).catch(() => {});
        }
    } catch (e) { console.warn("Marketplace link warn:", e); }

    res.json({ message: "Product created successfully", product_id: product.id });

  } catch (error: any) {
    console.error("Create Product Error:", error);
    res.status(500).json({ 
        message: "Error creating product", 
        error: error.message 
    });
  } finally {
      await dbClient.end();
  }
};