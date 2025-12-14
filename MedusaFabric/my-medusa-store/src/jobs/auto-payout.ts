// my-medusa-store/src/jobs/auto-payout.ts

import { MedusaContainer } from "@medusajs/medusa";
import { Modules } from "@medusajs/utils"; // Import Modules

// Import trực tiếp file Service Fabric
const FabricService = require("../services/fabric");

export default async function autoPayoutJob(
  container: MedusaContainer
) {
  // 1. Khởi tạo Fabric Service thủ công
  const fabricService = new FabricService(container);
  
  // 2. Lấy Order Module Service (Thay vì orderService cũ)
  const orderModuleService = container.resolve(Modules.ORDER);

  console.log("⏰ [CronJob] Checking orders for Auto-Payout...");

  try {
    // 3. Lấy danh sách đơn hàng (Cú pháp của Module Service hơi khác)
    const [orders, count] = await orderModuleService.listAndCountOrders({}, { 
        take: 50, 
        order: { created_at: "DESC" },
        select: ["id", "created_at"] // Chỉ lấy trường cần thiết
    });

    const now = new Date();

    for (const order of orders) {
        try {
            const chainData = await fabricService.queryOrder(order.id);

            if (!chainData || chainData.status === 'SETTLED') {
                continue;
            }

            // Logic kiểm tra điều kiện Payout
            const isPrepaidEligible = 
                chainData.paymentMethod === 'PREPAID' && 
                chainData.status === 'DELIVERED';
            
            const isCodEligible = 
                chainData.paymentMethod === 'COD' && 
                (chainData.status === 'COD_REMITTED' || chainData.codStatus === 'REMITTED');

            if (isPrepaidEligible || isCodEligible) {
                if (chainData.deliveryTimestamp) {
                    const deliveryTime = new Date(chainData.deliveryTimestamp);
                    const diffMinutes = (now.getTime() - deliveryTime.getTime()) / 60000;

                    // Kiểm tra 5 phút
                    if (diffMinutes >= 5.1) {
                        console.log(`💰 [CronJob] Order ${order.id} đủ điều kiện. Đang thanh toán...`);
                        await fabricService.payoutToSeller(order.id);
                        console.log(`✅ [CronJob] Payout thành công: ${order.id}`);
                    }
                }
            }
        } catch (err: any) {
            // Bỏ qua lỗi
        }
    }

  } catch (error) {
    console.error("❌ [CronJob] Error:", error);
  }
}

export const config = {
  name: "auto-payout-scanner",
  schedule: "0 0 1 1 *",
  data: {},
}