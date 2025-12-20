// my-medusa-store/src/jobs/auto-payout.ts

import { MedusaContainer } from "@medusajs/medusa";
import { Modules } from "@medusajs/utils"; // Import Modules

// Import trực tiếp file Service Fabric
const FabricService = require("../services/fabric");

export default async function autoPayoutJob(
  container: MedusaContainer
) {
  const fabricService = new FabricService(container);
  
  console.log("⏰ [CronJob] ------------------------------------------------");
  console.log("⏰ [CronJob] Scanning Blockchain orders for Auto-Payout...");

  try {
    // 1. Lấy danh sách tóm tắt từ Blockchain (để có ID chính xác của các sub-order)
    const allOrders = await fabricService.listAllOrdersForAdmin();

    if (!allOrders || allOrders.length === 0) {
        console.log("⏰ [CronJob] No orders found on ledger.");
        return;
    }

    const now = new Date();

    // 2. Lọc sơ bộ các đơn "có khả năng" được thanh toán để giảm tải query
    const candidates = allOrders.filter((o: any) => {
        // Đã thanh toán rồi thì bỏ qua
        if (o.status === 'SETTLED') return false;

        // Trường hợp PREPAID: Phải là DELIVERED
        if (o.payment_method === 'PREPAID' && o.status === 'DELIVERED') return true;

        // Trường hợp COD: Phải là REMITTED (Đã nộp tiền về sàn)
        if (o.payment_method === 'COD' && o.cod_status === 'REMITTED') return true;

        return false;
    });

    console.log(`⏰ [CronJob] Found ${candidates.length} candidate(s) for payout.`);

    // 3. Kiểm tra chi tiết từng đơn (Check thời gian)
    for (const cand of candidates) {
        try {
            // Query chi tiết để lấy deliveryTimestamp (Vì list tóm tắt không có trường này)
            // Dùng role 'admin' để query
            const fullOrder = await fabricService.queryOrder(cand.blockchain_id, 'admin');

            if (!fullOrder || !fullOrder.deliveryTimestamp) continue;

            const deliveryTime = new Date(fullOrder.deliveryTimestamp);
            // Tính số phút đã trôi qua: (Hiện tại - Giao hàng) / 60000
                    const diffMinutes = (now.getTime() - deliveryTime.getTime()) / 60000;

            // console.log(`   -> Check ${cand.blockchain_id}: Delivered ${diffMinutes.toFixed(1)} mins ago.`);

            // DEMO: 5 Phút (Thực tế có thể là 7 ngày)
            if (diffMinutes >= 5) {
                console.log(`💰 [CronJob] >>> Executing PAYOUT for: ${cand.blockchain_id}`);
                
                await fabricService.payoutToSeller(cand.blockchain_id);
                
                console.log(`✅ [CronJob] Payout SUCCESS: ${cand.blockchain_id}`);
                    }

        } catch (err: any) {
            console.error(`❌ [CronJob] Failed to payout ${cand.blockchain_id}: ${err.message}`);
        }
    }

  } catch (error) {
    console.error("❌ [CronJob] System Error:", error);
  }
}

export const config = {
  name: "auto-payout-scanner",
  // Chạy mỗi 1 phút để demo cho nhanh thấy kết quả
  // Cú pháp cron: * * * * * (Phút Giờ Ngày Tháng Thứ)
  schedule: "*/5  * * * *",
  // schedule: "0 0 1 1 *",
  data: {},
};