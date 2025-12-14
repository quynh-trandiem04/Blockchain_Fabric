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

  // Resolve các service cần thiết
  const cartService = container.resolve("cartService") as any;
  const orderService = container.resolve("orderService") as any;
  // Thêm marketplaceService để lấy thông tin Key của Seller
  const marketplaceService = container.resolve("marketplace") as any;
  const fabricService = new FabricService(container);

  try {
    // 1. Lấy Cart
    const cart = await cartService.retrieve(cart_id, {
      relations: ["items", "items.variant", "items.variant.product", "shipping_address", "billing_address", "region", "payment_sessions"]
    });

    if (!cart) return res.status(404).json({ message: "Cart not found" });

    // Lấy thông tin Shipper code
    const selectedShipperCode = (cart.metadata?.shipper_code as string); 

    // --- LOGIC CHIA SHIP & GROUP ĐƠN HÀNG ---
    const totalCartItemsAmount = cart.items.reduce((sum: number, item: any) => sum + (item.unit_price * item.quantity), 0);
    const totalCartShipping = cart.shipping_total || 0;

    // Group items theo Seller (dựa vào metadata của Product)
    const sellerGroups: Record<string, any[]> = {};

    for (const item of cart.items) {
      const product = item.variant.product as any; 
      const sellerCompanyID = product.metadata?.seller_company_id; 
      
      if (!sellerGroups[sellerCompanyID]) {
        sellerGroups[sellerCompanyID] = [];
      }
      sellerGroups[sellerCompanyID].push(item);
    }

    // 2. Hoàn tất đơn hàng trong Medusa (Master Order)
    let masterOrder;
    try {
        if (cart.payment_session && cart.payment_session.status !== "authorized") {
             await cartService.authorizePayment(cart.id);
        }
        masterOrder = await orderService.createFromCart(cart.id);
    } catch (e) {
        return res.status(400).json({ error: "Payment Failed or Order Exists" });
    }

    // 3. Tách đơn & Gửi lên Blockchain
    const blockchainResults: BlockchainResult[] = [];
    let subIndex = 1;

    // Duyệt qua từng Seller
    for (const [sellerID, items] of Object.entries(sellerGroups)) {
        
        // --- [MỚI] LẤY PUBLIC KEY RIÊNG CỦA SELLER ---
        // sellerID ở đây chính là company_code (ví dụ: Shop_123)
        let sellerPublicKey = null;
        try {
            const sellers = await marketplaceService.listSellers({ company_code: sellerID });
            if (sellers.length > 0) {
                // Lấy Public Key từ metadata của Seller đã được tạo lúc Approve
                sellerPublicKey = sellers[0].metadata?.rsa_public_key || null;
            }
        } catch (err) {
            console.warn(`⚠️ Could not fetch public key for seller ${sellerID}, using default fallback.`);
        }

        // --- TÍNH TOÁN TIỀN ---
        const subItemsTotal = items.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0);
        
        // Chia phí ship theo tỷ lệ giá trị
        let subShippingFee = 0;
        if (totalCartItemsAmount > 0) {
            subShippingFee = Math.round((subItemsTotal / totalCartItemsAmount) * totalCartShipping);
        } else {
            subShippingFee = Math.round(totalCartShipping / Object.keys(sellerGroups).length);
        }

        const subOrderTotal = subItemsTotal + subShippingFee;
        const splitOrderID = `${masterOrder.id}_${subIndex}`; 
        
        const isCOD = masterOrder.payments.some((p: any) => p.provider_id === 'manual' || p.provider_id === 'cod' || p.provider_id === 'pp_cod');
        const paymentMethod = isCOD ? "COD" : "PREPAID";
        const codAmount = isCOD ? subOrderTotal : 0; 

        // --- TẠO PAYLOAD ---
        const payload = {
            orderID: splitOrderID,
            paymentMethod: paymentMethod,
            sellerCompanyID: sellerID,       
            shipperCompanyID: selectedShipperCode, 
            
            // Thông tin khách hàng & giao hàng
            customerName: `${cart.shipping_address?.first_name} ${cart.shipping_address?.last_name}`,
            shipping_address: `${cart.shipping_address?.address_1}, ${cart.shipping_address?.city}`,
            shipping_phone: cart.shipping_address?.phone || "",
            
            // Chi tiết sản phẩm
            product_lines: items.map(i => ({
                product_name: i.title,
                quantity: i.quantity,
                unit_price: i.unit_price,
                subtotal: i.unit_price * i.quantity
            })),

            // Tài chính
            amount_untaxed: subItemsTotal,
            amount_total: subOrderTotal, 
            shipping_total: subShippingFee, 
            cod_amount: codAmount,

            // --- [QUAN TRỌNG] TRUYỀN KEY RIÊNG ---
            _sellerPublicKey: sellerPublicKey 
        };

        console.log(`🚀 Blockchain: ${splitOrderID} | Seller: ${sellerID} | Encrypt with Custom Key: ${!!sellerPublicKey}`);
        
        // Gọi Service (Service sẽ tự động dùng _sellerPublicKey nếu có)
        const txId = await fabricService.createOrder(payload);
        
        blockchainResults.push({
            split_order_id: splitOrderID,
            seller: sellerID,
            tx_id: txId
        });

        subIndex++;
    }

    // 4. Update Metadata cho Master Order để Admin tiện tra cứu
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