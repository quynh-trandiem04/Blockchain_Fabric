// my-medusa-store/src/admin/widgets/role-guard.tsx

import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { useEffect, useState } from "react";
import { Heading, Text, Button, Badge } from "@medusajs/ui";

const ROLE_ADMIN = 'ecommerceplatformorgmsp';
const ROLE_SELLER = 'sellerorgmsp';
const ROLE_SHIPPER = 'shipperorgmsp';

const RoleGuardWidget = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [shouldBlock, setShouldBlock] = useState(false);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch("/admin/users/me", {
            method: "GET",
            credentials: "include",
        });
        
        if (res.ok) {
            const data = await res.json();
            analyzeUser(data.user);
        } else {
            // Lỗi 401/403 -> Chưa đăng nhập -> Chặn luôn
            setShouldBlock(true);
            window.location.href = "/app/login";
        }
      } catch (err) {
        console.error("RoleGuard Connection Error");
        setIsLoading(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();
  }, []);

  const analyzeUser = (userData: any) => {
      const email = (userData?.email || "").toLowerCase();
      const metaRole = userData?.metadata?.fabric_role; 
      const normalizedRole = (metaRole || "").toLowerCase().trim();

      let decision = "UNKNOWN";
      let reason = "";

      // --- LOGIC PHÂN QUYỀN MỚI ---

      // 1. Ưu tiên cao nhất: Email Admin cứng (Super Admin)
      if (email.includes('admin') || email.includes('thuquynh')) {
          decision = "ALLOW";
          reason = "Email Admin Whitelist";
      }
      // 2. Check Role Admin tổ chức (metadata: ecommerceplatformorgmsp)
      else if (normalizedRole === ROLE_ADMIN) {
          decision = "ALLOW";
          reason = "Role Admin hợp lệ";
      }
      // 3. Check Seller
      else if (normalizedRole === ROLE_SELLER) {
          decision = "BLOCK_SELLER";
          reason = "Là Seller -> Chặn";
      }
      // 4. Check Shipper
      else if (normalizedRole === ROLE_SHIPPER) {
          decision = "BLOCK_SHIPPER";
          reason = "Là Shipper -> Chặn";
      }
      // 5. Trường hợp Rỗng (Khách) hoặc Role lạ -> CHẶN HẾT
      else {
          decision = "BLOCK_GUEST";
          reason = !normalizedRole ? "Tài khoản Khách (Không có Role)" : `Role lạ: ${normalizedRole}`;
      }

      setDebugInfo({
          email,
          originalRole: metaRole,
          normalizedRole,
          decision,
          reason
      });

      // NẾU QUYẾT ĐỊNH LÀ BLOCK -> THỰC THI NGAY
      if (decision.startsWith("BLOCK")) {
          setShouldBlock(true);
          
          // Tự động Redirect
          setTimeout(() => {
              if (decision === "BLOCK_SELLER") window.location.href = "/app/partner";
              else if (decision === "BLOCK_SHIPPER") window.location.href = "/app/shipper";
              else window.location.href = "/app/login"; // Khách hoặc role lạ -> Về login
          }, 1500);
      }
  };

  if (isLoading) return null;

  // --- MÀN HÌNH CHẶN (BLOCKING UI) ---
  if (shouldBlock) {
      return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(255, 255, 255, 0.98)', zIndex: 9999,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
            <Heading level="h1" className="text-red-600 text-4xl mb-4">⛔ TRUY CẬP BỊ TỪ CHỐI</Heading>
            <div className="bg-gray-100 p-6 rounded-lg border border-gray-300 text-center">
                <Text className="text-lg font-bold mb-2">Tài khoản: {debugInfo.email}</Text>
                <Text className="mb-4">Lý do: <Badge color="red">{debugInfo.reason}</Badge></Text>
                <Text className="text-gray-500 italic">Đang chuyển hướng...</Text>
            </div>
            <Button variant="secondary" className="mt-6" onClick={() => window.location.href = "/app/login"}>
                Đăng xuất ngay
            </Button>
        </div>
      );
  }

  // --- NẾU LÀ ADMIN (ALLOW) ---
  // Return null để ẩn widget đi, trả lại giao diện sạch cho Admin
  return null;
};

export const config = defineWidgetConfig({
  // FIX 1: Sửa tên zone 'pricing' thành 'price_list'
  zone: [
    "order.list.before",
    "order.details.before",
    "product.list.before",
    "product.details.before",
    "customer.list.before",
    "customer.details.before",
    "price_list.list.before" 
  ],
});

export default RoleGuardWidget;