// src/subscribers/order-placed.ts

import { 
  type SubscriberConfig, 
  type SubscriberArgs,
} from "@medusajs/framework";
import { Modules } from "@medusajs/utils";

// Import Fabric Service (đảm bảo đường dẫn đúng)
const FabricService = require("../services/fabric");

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  
  const fabricService = new FabricService(container); 
  const remoteQuery = container.resolve("remoteQuery");
  const marketplaceService = container.resolve("marketplace") as any;

  try {
      console.log(`[Subscriber] 📦 Bắt đầu xử lý đơn hàng Medusa: ${data.id}`);

      // 1. QUERY GRAPH ĐẦY ĐỦ
      const query = {
          entryPoint: "order",
          fields: [
              "*", 
              "metadata",
              "shipping_address.*",
              "items.*",
              "items.variant.title",
              "items.variant.product.metadata", // Cần metadata để lấy seller_id
              "shipping_methods.*", 
              "payment_collections.*",
              "payment_collections.payment_sessions.*"
          ],
          variables: { id: data.id }
      };

      const result = await remoteQuery(query);
      const order = result[0];

      if (!order) {
          console.error(`[Subscriber] ❌ Không tìm thấy đơn hàng ${data.id}`);
          return;
      }

      // 2. GOM NHÓM ITEMS THEO SELLER
      const sellerGroups: Record<string, any[]> = {};
      let totalOrderValue = 0;

      for (const item of order.items) {
          // Lấy Seller ID từ metadata sản phẩm (đã gán khi tạo sản phẩm)
          const sellerCompanyID = item.variant?.product?.metadata?.seller_company_id || "Unknown_Seller";
          if (!sellerGroups[sellerCompanyID]) {
              sellerGroups[sellerCompanyID] = [];
          }
          sellerGroups[sellerCompanyID].push(item);
          totalOrderValue += (item.unit_price * item.quantity);
      }

      console.log(`[Subscriber] Tìm thấy ${Object.keys(sellerGroups).length} seller trong đơn hàng.`);

      // 3. TÍNH TOÁN CHUNG
      let totalShippingFee = order.shipping_total || 0;
      
      // --- FIX LOGIC PAYMENT METHOD ---
      // Ưu tiên lấy từ Metadata (do Frontend gửi lên)
      let paymentMethod = "PREPAID"; // Mặc định
      const metadataPaymentType = order.metadata?.payment_type;

      if (metadataPaymentType === 'cod') {
          paymentMethod = "COD";
      } else {
          // Fallback: Check provider_id nếu metadata không có (đề phòng)
      if (order.payment_collections?.length > 0) {
          const sessions = order.payment_collections[0].payment_sessions || [];
          const activeSession = sessions.find((s: any) => s.status === "pending" || s.status === "authorized");
          if (activeSession?.provider_id?.includes("cod")) {
              paymentMethod = "COD";
          }
      }
      }
      
      console.log(`[Subscriber] Payment Method Resolved: ${paymentMethod}`);

      // --- FIX LOGIC SHIPPER ID ---
      // Lấy từ metadata hoặc mặc định là GHN
      const shipperCode = order.metadata?.shipper_code || "GHN"; 

      // 4. DUYỆT TỪNG NHÓM VÀ GỬI BLOCKCHAIN
      let subIndex = 1;
      for (const [sellerID, items] of Object.entries(sellerGroups)) {
          console.log(`--- Xử lý nhóm Seller: ${sellerID} ---`);

          // 4.1. Lấy Public Key của Seller
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

          // 4.2. Tính toán tiền cho Sub-order
          const subTotalItems = items.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0);
          
          // Chia phí ship theo tỷ trọng giá trị
          let subShipping = 0;
          if (totalOrderValue > 0) {
              subShipping = Math.round((subTotalItems / totalOrderValue) * totalShippingFee);
          } else {
              subShipping = Math.round(totalShippingFee / Object.keys(sellerGroups).length);
          }

          const subTotal = subTotalItems + subShipping;
          const splitOrderID = `${order.id}_${subIndex}`; // VD: order_123_1
          
          // Tính tiền thu hộ (COD Amount)
          const codAmount = paymentMethod === "COD" ? subTotal : 0;

          // 4.3. Tạo Product Lines Payload
          const productLines = items.map((i: any) => ({
              product_name: i.variant?.title ? `${i.title} (${i.variant.title})` : i.title,
              quantity: i.quantity,
              unit_price: i.unit_price,
              subtotal: i.unit_price * i.quantity
          }));

          // 4.4. Payload gửi Blockchain
          const payload = {
              orderID: splitOrderID,
              paymentMethod: paymentMethod,
              sellerCompanyID: sellerID, 
              shipperCompanyID: shipperCode,
              
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

          // 4.5. Gọi Service Submit
          try {
              console.log('Payload gửi đi: ', { ...payload, _sellerPublicKey: "HIDDEN" });
              const txId = await fabricService.createOrder(payload, sellerID);
              console.log(`✅ [${splitOrderID}] Ghi thành công! TX: ${txId}`);
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