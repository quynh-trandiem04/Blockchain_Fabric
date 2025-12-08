// my-medusa-store/src/api/store/market/complete-cart/route.ts

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";

const FabricService = require("../../../../services/fabric");

interface BlockchainResult {
    split_order_id: string;
    seller: string;
    tx_id: string;
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { cart_id } = req.body as { cart_id: string };
  const container = req.scope;

  const cartService = container.resolve("cartService") as any;
  const orderService = container.resolve("orderService") as any;
  const fabricService = new FabricService(container);

  try {
    // Lấy Cart
    const cart = await cartService.retrieve(cart_id, {
      relations: ["items", "items.variant", "items.variant.product", "shipping_address", "billing_address", "region", "payment_sessions"]
    });

    if (!cart) return res.status(404).json({ message: "Cart not found" });

    // Lấy thông tin Shipper code
    const selectedShipperCode = (cart.metadata?.shipper_code as string) || "GHN"; 

    // --- LOGIC MỚI: TÍNH TOÁN TỔNG GIÁ TRỊ HÀNG ĐỂ CHIA SHIP ---
    // Tổng tiền hàng chưa thuế của cả giỏ (dùng để tính tỷ lệ)
    const totalCartItemsAmount = cart.items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    // Tổng phí ship của cả giỏ
    const totalCartShipping = cart.shipping_total || 0;

    // Group items theo Seller
    const sellerGroups: Record<string, any[]> = {};

    for (const item of cart.items) {
      // Ép kiểu any cho product để truy cập metadata không bị lỗi TS
      const product = item.variant.product as any; 
      const sellerCompanyID = product.metadata?.seller_company_id || "Shop_A"; 
      
      if (!sellerGroups[sellerCompanyID]) {
        sellerGroups[sellerCompanyID] = [];
      }
      sellerGroups[sellerCompanyID].push(item);
    }

    // Hoàn tất đơn hàng trong Medusa
    let masterOrder;
    try {
        // Kiểm tra trạng thái thanh toán trước khi authorize
        if (cart.payment_session && cart.payment_session.status !== "authorized") {
             await cartService.authorizePayment(cart.id);
        }
        masterOrder = await orderService.createFromCart(cart.id);
    } catch (e) {
        return res.status(400).json({ error: "Payment Failed or Order Exists" });
    }

    // 3. Fix lỗi mảng: Khai báo kiểu cụ thể
    const blockchainResults: BlockchainResult[] = [];
    let subIndex = 1;

    // Duyệt qua từng Seller để tạo đơn con
    for (const [sellerID, items] of Object.entries(sellerGroups)) {
        // A. Tính tổng tiền hàng cho đơn con này
        const subItemsTotal = items.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0);
        
        // B. [LOGIC CHIA SHIP]: Tính phí ship theo tỷ lệ giá trị
        // Công thức: (Tiền hàng đơn con / Tổng tiền hàng giỏ) * Tổng phí ship
        let subShippingFee = 0;
        if (totalCartItemsAmount > 0) {
            subShippingFee = Math.round((subItemsTotal / totalCartItemsAmount) * totalCartShipping);
        } else {
            // Trường hợp hàng 0 đồng (ít gặp), chia đều hoặc dồn hết vào đơn 1
            subShippingFee = Math.round(totalCartShipping / Object.keys(sellerGroups).length);
        }

        // C. Tổng cộng đơn con = Tiền hàng + Tiền ship đã chia
        const subOrderTotal = subItemsTotal + subShippingFee;
        
        const splitOrderID = `${masterOrder.id}_${subIndex}`; 
        
        const isCOD = masterOrder.payments.some(p => p.provider_id === 'manual' || p.provider_id === 'cod');
        const paymentMethod = isCOD ? "COD" : "PREPAID";
        
        // Nếu là COD thì thu đúng số tiền tổng của đơn con này (Hàng + Ship đã chia)
        const codAmount = isCOD ? subOrderTotal : 0; 

        const payload = {
            orderID: splitOrderID,
            paymentMethod: paymentMethod,
            sellerCompanyID: sellerID,       
            shipperCompanyID: selectedShipperCode, 
            
            customerName: `${cart.shipping_address?.first_name} ${cart.shipping_address?.last_name}`,
            shipping_address: `${cart.shipping_address?.address_1}, ${cart.shipping_address?.city}`,
            shipping_phone: cart.shipping_address?.phone || "",
            
            product_lines: items.map(i => ({
                product_name: i.title,
                quantity: i.quantity,
                unit_price: i.unit_price,
                subtotal: i.unit_price * i.quantity
            })),

            amount_untaxed: subItemsTotal,
            amount_total: subOrderTotal, // Tổng tiền cuối cùng của đơn con
            shipping_total: subShippingFee, // Phí ship hiển thị cho đơn con này
            cod_amount: codAmount
        };

        console.log(`🚀 Blockchain: ${splitOrderID} | ShipFee: ${subShippingFee} | Total: ${subOrderTotal}`);
        
        const txId = await fabricService.createOrder(payload);
        
        blockchainResults.push({
            split_order_id: splitOrderID,
            seller: sellerID,
            tx_id: txId
        });

        subIndex++;
    }

    // Update Master Order
    await orderService.update(masterOrder.id, {
        metadata: {
            blockchain_data: blockchainResults,
            shipper_code: selectedShipperCode
        }
    });

    res.json({
        message: "Order Completed",
        order: masterOrder,
        blockchain: blockchainResults
    });

  } catch (error: any) {
    console.error("API Error:", error);
    res.status(500).json({ error: error.message });
  }
};