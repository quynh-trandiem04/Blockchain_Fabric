// src/subscribers/order-placed.ts

import { 
  type SubscriberConfig, 
  type SubscriberArgs,
} from "@medusajs/framework";
import { Modules } from "@medusajs/utils"; // Import Modules để gọi User Service

// Import Fabric Service
const FabricService = require("../services/fabric");

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  
  const fabricService = new FabricService(container); 
  const remoteQuery = container.resolve("remoteQuery");
  const marketplaceService = container.resolve("marketplace") as any;
  
  // 🔥 Resolve User Module để tra cứu thông tin Shipper
  const userModuleService = container.resolve(Modules.USER);

  try {
      console.log(`[Subscriber] 📦 Bắt đầu xử lý đơn hàng Medusa: ${data.id}`);

      // =================================================================
      // BƯỚC 1: QUERY ĐƠN HÀNG
      // =================================================================
      const orderQuery = {
          entryPoint: "order",
          fields: [
              "*", 
              "metadata",
              "shipping_address.*",
              "items.*", 
              "shipping_methods.*", // Lấy phương thức vận chuyển
              "payment_collections.*",
              "payment_collections.payment_sessions.*"
          ],
          variables: { id: data.id }
      };

      const orderResult = await remoteQuery(orderQuery);
      const order = orderResult[0];

      if (!order) {
          console.error(`[Subscriber] ❌ Không tìm thấy đơn hàng ${data.id}`);
          return;
      }

      // =================================================================
      // BƯỚC 2: QUERY PRODUCT METADATA (SELLER INFO)
      // =================================================================
      const variantIds = order.items
          .map((i: any) => i.variant_id)
          .filter((id: any) => !!id); 

      const variantMap: Record<string, { sellerId: string, title: string }> = {};

      if (variantIds.length > 0) {
          const productQuery = {
              entryPoint: "product_variant",
              fields: ["id", "title", "product.metadata"],
              variables: { filters: { id: variantIds } }
          };
          const variants = await remoteQuery(productQuery);
          variants.forEach((v: any) => {
              variantMap[v.id] = {
                  title: v.title,
                  sellerId: v.product?.metadata?.seller_company_id || "Unknown_Seller"
              };
          });
      }

      // =================================================================
      // BƯỚC 3: GOM NHÓM VÀ TÍNH TOÁN
      // =================================================================
      const sellerGroups: Record<string, any[]> = {};
      let totalOrderValue = 0;

      for (const item of order.items) {
          const info = variantMap[item.variant_id] || { sellerId: "Unknown_Seller", title: "" };
          const sellerCompanyID = info.sellerId;
          item.variant_title = info.title; 

          if (!sellerGroups[sellerCompanyID]) {
              sellerGroups[sellerCompanyID] = [];
          }
          sellerGroups[sellerCompanyID].push(item);
          totalOrderValue += (item.unit_price * item.quantity);
      }

      // --- FIX LOGIC TÍNH PHÍ SHIP ---
      // Nếu shipping_total = 0 nhưng có shipping_methods, hãy cộng thủ công
      let totalShippingFee = order.shipping_total || 0;
      if (totalShippingFee === 0 && order.shipping_methods && order.shipping_methods.length > 0) {
          totalShippingFee = order.shipping_methods.reduce((acc: number, method: any) => acc + (method.amount || 0), 0);
      }
      
      // --- FIX PAYMENT METHOD ---
      let paymentMethod = "PREPAID"; 
      const metadataPaymentType = order.metadata?.payment_type;

      if (metadataPaymentType === 'cod') {
          paymentMethod = "COD";
      } else if (order.payment_collections?.length > 0) {
          const sessions = order.payment_collections[0].payment_sessions || [];
          const activeSession = sessions.find((s: any) => s.status === "pending" || s.status === "authorized");
          if (activeSession?.provider_id?.includes("cod")) {
              paymentMethod = "COD";
          }
      }

      // =================================================================
      // 🔥 BƯỚC QUAN TRỌNG: LẤY SHIPPER COMPANY CODE TỪ DB 🔥
      // =================================================================
      let shipperCode = "GHN"; // Giá trị mặc định
      const shipperUserId = order.metadata?.shipper_id;

      if (shipperUserId) {
          try {
              console.log(`[Subscriber] Tìm Shipper info cho UserID: ${shipperUserId}`);
              // Gọi User Service để lấy thông tin shipper
              const shipperUser = await userModuleService.retrieveUser(shipperUserId);
              
              // Lấy company_code từ metadata của user
              if (shipperUser && shipperUser.metadata?.company_code) {
                  shipperCode = shipperUser.metadata.company_code as string;
                  console.log(`[Subscriber] ✅ Đã tìm thấy Company Code: ${shipperCode}`);
              } else {
                  console.warn(`[Subscriber] User ${shipperUserId} không có metadata.company_code. Dùng mặc định GHN.`);
              }
          } catch (e: any) {
              console.error(`[Subscriber] ❌ Lỗi tra cứu Shipper User: ${e.message}`);
          }
      } else {
          console.log("[Subscriber] Không tìm thấy shipper_id trong order metadata. Dùng mặc định GHN.");
      }

      console.log(`[Subscriber] Final Config -> Payment: ${paymentMethod} | ShipFee: ${totalShippingFee} | Shipper: ${shipperCode}`);

      // =================================================================
      // BƯỚC 5: SUBMIT LÊN BLOCKCHAIN
      // =================================================================
      let subIndex = 1;
      for (const [sellerID, items] of Object.entries(sellerGroups)) {
          let sellerPublicKey = null;
          try {
              const sellers = await marketplaceService.listSellers({ company_code: sellerID });
              if (sellers.length > 0) {
                  sellerPublicKey = sellers[0].metadata?.rsa_public_key;
              }
          } catch (e) { console.warn(`⚠️ Lỗi tìm seller ${sellerID}:`, e); }

          if (!sellerPublicKey) {
              console.error(`❌ BỎ QUA: Không có Public Key cho Seller ${sellerID}`);
              continue; 
          }

          const subTotalItems = items.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0);
          
          // Chia phí ship theo tỷ trọng
          let subShipping = 0;
          if (totalOrderValue > 0) {
              subShipping = Math.round((subTotalItems / totalOrderValue) * totalShippingFee);
          } else {
              subShipping = Math.round(totalShippingFee / Object.keys(sellerGroups).length);
          }

          const subTotal = subTotalItems + subShipping;
          const splitOrderID = `${order.id}_${subIndex}`;
          const codAmount = paymentMethod === "COD" ? subTotal : 0;

          const productLines = items.map((i: any) => ({
              product_name: i.variant_title ? `${i.title} (${i.variant_title})` : i.title,
              quantity: i.quantity,
              unit_price: i.unit_price,
              subtotal: i.unit_price * i.quantity
          }));

          const payload = {
              orderID: splitOrderID,
              paymentMethod: paymentMethod,
              sellerCompanyID: sellerID, 
              shipperCompanyID: shipperCode, // Đã được lấy từ DB User
              
              customerName: `${order.shipping_address?.first_name || ''} ${order.shipping_address?.last_name || ''}`.trim(),
              shipping_address: `${order.shipping_address?.address_1 || ''}, ${order.shipping_address?.city || ''}`,
              shipping_phone: order.shipping_address?.phone || '',
              
              product_lines: productLines,
              amount_untaxed: subTotalItems,
              amount_total: subTotal,
              shipping_total: subShipping,
              cod_amount: codAmount,

              _sellerPublicKey: sellerPublicKey 
          };

          try {
              console.log(`[Submit] ${splitOrderID} -> Shipper: ${shipperCode}, Fee: ${subShipping}, COD: ${codAmount}`);
              await fabricService.createOrder(payload, sellerID);
              console.log(`✅ [${splitOrderID}] Ghi thành công!`);
          } catch (err: any) {
              console.error(`❌ [${splitOrderID}] Lỗi ghi Blockchain:`, err.message);
          }

          subIndex++;
      }

  } catch (error: any) {
      console.error(`[Subscriber] ❌ Lỗi tổng quát:`, error);
  }
}

export const config: SubscriberConfig = {
  event: "order.placed", 
};