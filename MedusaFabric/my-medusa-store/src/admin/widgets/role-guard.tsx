// my-medusa-store/src/admin/widgets/role-guard.tsx

import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { useEffect, useState } from "react";
import { Heading, Text, Button, Badge } from "@medusajs/ui";

const ROLE_ADMIN = 'ecommerceplatformorgmsp';
const ROLE_SELLER = 'sellerorgmsp';
const ROLE_SHIPPER = 'shipperorgmsp';

const STOREFRONT_URL = "http://localhost:8000"; 

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

      // 1. Admin role
      if (normalizedRole === ROLE_ADMIN) {
          decision = "ALLOW";
          reason = "Role Admin hợp lệ";
      }
      // 2. Check Seller
      else if (normalizedRole === ROLE_SELLER) {
          decision = "BLOCK_SELLER";
          reason = "Là Seller -> Chuyển về Dashboard Seller";
      }
      // 3. Check Shipper
      else if (normalizedRole === ROLE_SHIPPER) {
          decision = "BLOCK_SHIPPER";
          reason = "Là Shipper -> Chuyển về Dashboard Shipper";
      }
      // 4. Trường hợp Rỗng (Khách) hoặc Role lạ 
      else {
          decision = "BLOCK_GUEST";
          reason = "Khách hàng -> Chuyển về Trang chủ mua sắm";
      }

      setDebugInfo({ email, reason });

      // NẾU QUYẾT ĐỊNH LÀ BLOCK -> ĐIỀU HƯỚNG SANG PORT 8000
      if (decision.startsWith("BLOCK")) {
          setShouldBlock(true);
          
          // Tự động Redirect
          setTimeout(() => {
              if (decision === "BLOCK_SELLER") {
                  // Về trang Seller
                  window.location.href = `${STOREFRONT_URL}/dk/partner`;
              } 
              else if (decision === "BLOCK_SHIPPER") {
                  // Về trang Shipper
                  window.location.href = `${STOREFRONT_URL}/dk/shipper`;
              } 
              else {
                  // Khách/Lạ -> Về trang chủ Storefront
                  window.location.href = `${STOREFRONT_URL}/`;
              }
          }, 1500);
      }
  };

  if (isLoading) return null;

  // --- MÀN HÌNH CHẶN & CHUYỂN HƯỚNG ---
  if (shouldBlock) {
      return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(255, 255, 255, 0.98)', zIndex: 9999,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
            <Heading level="h1" className="text-red-600 text-4xl mb-4">⛔ ĐANG CHUYỂN HƯỚNG</Heading>
            <div className="bg-gray-100 p-6 rounded-lg border border-gray-300 text-center max-w-md">
                <Text className="text-lg font-bold mb-2">Xin chào: {debugInfo.email}</Text>
                <Text className="mb-4 text-gray-700">{debugInfo.reason}</Text>
                
                <div className="flex justify-center my-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
                
                <Text className="text-gray-500 italic text-xs">
                    Đang đưa bạn về <b>{STOREFRONT_URL}</b>...
                </Text>
            </div>
            {/* Nút thoát hiểm nếu redirect treo */}
            <Button variant="secondary" className="mt-6" onClick={() => window.location.href = "/app/login"}>
                Đăng xuất khỏi Admin
            </Button>
        </div>
      );
  }

  // Nếu là Admin -> Ẩn widget đi
  return null;
};

export const config = defineWidgetConfig({
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