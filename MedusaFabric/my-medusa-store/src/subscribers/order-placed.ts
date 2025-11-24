import { 
  type SubscriberConfig, 
  type SubscriberArgs,
} from "@medusajs/framework";

const FabricService = require("../services/fabric");

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  
  const fabricService = new FabricService(container); 
  const remoteQuery = container.resolve("remoteQuery");

  try {
      console.log(`[Subscriber] Xử lý đơn hàng: ${data.id}`);

      // 1. QUERY GRAPH
      const query = {
          entryPoint: "order",
          fields: [
              "*", 
              "shipping_address.*",
              
              "items.*",
              "items.variant.title",
              "items.variant.options.value",
              "items.variant.options.option.title",
              
              // --- QUAN TRỌNG: Lấy toàn bộ trường của shipping_methods ---
              "shipping_methods.*", 
              // Lấy thêm tax_lines để chắc chắn (nếu giá ship bao gồm thuế)
              "shipping_methods.tax_lines.*" 
          ],
          variables: { id: data.id }
      };

      const result = await remoteQuery(query);
      const order = result[0];

      if (!order) {
          console.error(`[Subscriber] Lỗi: Không tìm thấy đơn hàng ${data.id}`);
          return;
      }

      // 2. TÍNH TIỀN HÀNG (Logic cũ đã đúng)
      const items = order.items || [];
      const processedLines = items.map((item: any) => {
          let variantInfo = item.variant?.title || "";
          if (item.variant?.options) {
             const optionsStr = item.variant.options
                .map((opt: any) => `${opt.option?.title}: ${opt.value}`)
                .join(", ");
             if (!variantInfo || variantInfo === item.title) {
                 variantInfo = optionsStr;
             }
          }
          const displayName = variantInfo ? `${item.title} (${variantInfo})` : item.title;
          const qty = item.quantity ?? 1; 
          const price = item.unit_price ?? 0;
          const realSubtotal = price * qty;

          return { 
              product_name: displayName,
              quantity: qty,
              unit_price: price,
              subtotal: realSubtotal
          };
      });

      const calculatedProductTotal = processedLines.reduce((sum: number, line: any) => sum + line.subtotal, 0);
      
      // =================================================================
      // 3. TÍNH PHÍ SHIP (FIX LỖI 0 ĐỒNG)
      // =================================================================
      
      let finalShippingTotal = 0;

      // Cách 1: Thử lấy từ order root
      if (order.shipping_total && order.shipping_total > 0) {
          finalShippingTotal = order.shipping_total;
      } 
      // Cách 2: Nếu root = 0, tự cộng từ shipping_methods
      else if (order.shipping_methods && order.shipping_methods.length > 0) {
        //   console.log("[Subscriber] Shipping Total gốc là 0, đang tính lại thủ công...");
          
          finalShippingTotal = order.shipping_methods.reduce((sum: number, method: any) => {
              // Medusa v2 có thể lưu giá ở 'price', 'amount' hoặc 'total'
              // Ta kiểm tra tất cả, ưu tiên 'amount' hoặc 'price'
              const price = method.amount ?? method.price ?? method.total ?? 0;
              console.log(` -> Method: ${method.name}, Price found: ${price}`);
              return sum + price;
          }, 0);
      }

      console.log(`[Subscriber] => Phí Ship chốt: ${finalShippingTotal}`);

      // =================================================================
      // 4. TỔNG CỘNG (Amount Total)
      // =================================================================
      
      // Công thức: Tổng hàng + Tổng ship
      const calculatedTotal = calculatedProductTotal + finalShippingTotal;

      // 5. THANH TOÁN
      const paymentMethod = "PREPAID";
      const calculatedCodAmount = 0; 

      // 6. TẠO PAYLOAD
      const payload = {
          orderID: order.id,
          paymentMethod: paymentMethod, 
          sellerID: "SellerOrgMSP",
          shipperID: "ShipperOrgMSP",
          
          customerName: `${order.shipping_address?.first_name || ''} ${order.shipping_address?.last_name || ''}`.trim(),
          
          product_lines: processedLines,
          
          amount_untaxed: calculatedProductTotal, // 30
          
          // Tổng này giờ đây sẽ bằng 30 + 10 = 40 (nếu ship = 10)
          amount_total: calculatedTotal,      
          
          shipping_total: finalShippingTotal, // 10
          cod_amount: calculatedCodAmount,    // 0

          shipping_address: `${order.shipping_address?.address_1 || ''}, ${order.shipping_address?.city || ''}`,
          shipping_phone: order.shipping_address?.phone || ''
      };

      console.log(`[Subscriber] Payload chuẩn bị gửi:`, JSON.stringify(payload, null, 2));

      const txId = await fabricService.createOrder(payload);
      console.log(`[Subscriber] ✅ Ghi Block thành công! TX ID: ${txId}`);

  } catch (error) {
      console.error(`[Subscriber] ❌ Lỗi xử lý đơn hàng:`, error);
  }
}

export const config: SubscriberConfig = {
  event: "order.placed", 
};