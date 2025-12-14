// my-medusa-store\src\api\store\fabric\orders\list\route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import jwt from "jsonwebtoken";
import { Modules } from "@medusajs/utils";
import { Client } from "pg"; // <-- CẦN IMPORT NÀY VÀ npm install pg

// LƯU Ý: Đảm bảo biến môi trường JWT_SECRET được set đúng
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const DB_URL = process.env.DATABASE_URL;
const FabricServiceClass = require("../../../../../services/fabric");
 
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
    let actorId: string | undefined;
    let authId: string | undefined;

    // 1. LẤY ID TỪ AUTH CONTEXT (Ưu tiên ID đã được resolve)
    const authContext = (req as any).auth;
    
    // ID hợp lệ (user_01...) đã được resolved bởi seller-me
    actorId = authContext?.actor_id || authContext?.user_id;
    
    // Auth Identity ID (authid_01...) dùng để tra cứu
    authId = authContext?.auth_identity_id;

    // 2. LẤY Auth ID TỪ TOKEN (Nếu context không có gì)
    if (!authId) {
        const token = req.headers.authorization?.split(" ")[1];
        if (token) {
            try {
            const decoded: any = jwt.verify(token, JWT_SECRET);
                authId = decoded.auth_identity_id || decoded.sub;
            } catch (err) {}
        }
    }

    // 3. TỰ TRA CỨU DB NẾU THIẾU ACTOR ID (Logic DB Lookup)
    if (!actorId && authId && DB_URL) {
        console.log(`[List API] 🔄 Attempting DB lookup for Auth ID: ${authId}`);
        const dbClient = new Client({
            connectionString: DB_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        try {
            await dbClient.connect();
            const linkRes = await dbClient.query(
                `SELECT user_id FROM user_user_auth_auth_identity WHERE auth_identity_id = $1`,
                [authId]
            );
            if (linkRes.rows.length > 0) {
                actorId = linkRes.rows[0].user_id; // Đã tìm thấy User ID hợp lệ
                console.log(`[List API] ✅ DB lookup successful. Found actorId: ${actorId}`);
            }
        } catch (e) {
            console.error("[List API] ❌ DB Lookup Error:", e);
        } finally {
            await dbClient.end();
        }
    }

    // 4. KIỂM TRA ACTOR ID CUỐI CÙNG
    if (!actorId) {
        console.warn("[List API] 🚫 Final Check: UNAUTHORIZED - Actor ID not found.");
        return res.status(401).json({ error: "UNAUTHORIZED: Missing user ID for authorization." });
    }

    // --- 5. LOGIC CHÍNH (Đã có actorId) ---
    try {
        const userModuleService: any = req.scope.resolve(Modules.USER);
            
        // ❌ Bỏ qua resolve container (Dễ lỗi)
        // const FabricServiceConstructor = req.scope.resolve("fabricService");
        
        // ✅ KHỞI TẠO INSTANCE BẰNG CLASS ĐÃ REQUIRE
        const fabricService = new FabricServiceClass(req.scope); 
        
        // 3. (Nếu muốn kiểm tra lỗi Runtime)
        if (typeof fabricService.listSellerOrders !== 'function') {
            // Nếu Service đã được resolve nhưng listSellerOrders không phải là hàm, 
            // điều đó có nghĩa là Service chưa được khởi tạo đúng cách.
            throw new Error("FabricService instance missing methods.");
        }

        const user = await userModuleService.retrieveUser(actorId, {
            select: ["metadata"]
        });

        const sellerCompanyID = user.metadata?.company_code;

        if (!sellerCompanyID) {
            return res.status(403).json({ error: "FORBIDDEN: User is not associated with a Seller company." });
        }

        console.log(`[List API] 🔍 Listing Fabric orders for Seller: ${sellerCompanyID} (User ID: ${actorId})`);

        // 3. GỌI HÀM RICH QUERY TRONG SERVICE
        // Hàm này sẽ dùng QueryOrdersByString (Chaincode Go)
        const orders = await fabricService.listSellerOrders(sellerCompanyID);

        console.log(`[List API] ✅ Found ${orders.length} orders on Fabric for ${sellerCompanyID}`);

        // 4. TRẢ VỀ DANH SÁCH ORDERS
        return res.json({ orders: orders });

    } catch (error: any) {
        // Log lỗi chi tiết từ Chaincode nếu có
        console.error("ERROR Listing Fabric Orders:", error.message);
        res.status(500).json({ error: error.message });
    }
};