import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Button, Heading, Text } from "@medusajs/ui";
// @ts-ignore
import { useAdminUser } from "medusa-react";
import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

// Component màn hình chặn
const BlockScreen = ({ message, showLogout = false }: any) => {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div 
        style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'white',
            zIndex: 2147483647, // Max Z-Index
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            isolation: 'isolate'
        }}
    >
        {/* CSS HACK MẠNH TAY:
            1. #root: Ẩn toàn bộ ứng dụng Medusa chính.
            2. aside, nav: Ẩn Sidebar và Header nếu chúng nằm ngoài root.
            3. .medusa-ui-app: Class thường thấy của container chính.
        */}
        <style>
            {`
               #root, #app, .medusa-ui-app { 
                   display: none !important; 
                   opacity: 0 !important;
                   visibility: hidden !important;
               }
               
               /* Ẩn Sidebar và Header cụ thể */
               aside, nav, header {
                   display: none !important;
               }

               body { 
                   overflow: hidden !important; 
                   background-color: white !important;
               }
            `}
        </style>

        <Heading level="h1" className="text-ui-fg-error mb-4 text-3xl">⛔</Heading>
        <Heading level="h2" className="text-ui-fg-base mb-2 text-xl">TRUY CẬP BỊ TỪ CHỐI</Heading>
        <Text className="mb-6 text-gray-500 max-w-md text-center">{message}</Text>
        
        {showLogout ? (
            <Button variant="danger" size="large" onClick={() => {
                // Xóa cookie/token và redirect
                document.cookie.split(";").forEach((c) => {
                    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
                });
                localStorage.clear();
                window.location.href = "/app/login";
            }}>
                Đăng xuất ngay
            </Button>
        ) : (
            <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <Text className="text-gray-400 text-sm">Đang xác thực bảo mật...</Text>
            </div>
        )}
    </div>,
    document.body // Render trực tiếp vào body (nằm ngoài #root bị ẩn)
  );
};

const RoleGuardWidget = () => {
  // @ts-ignore
  const { user, isLoading } = useAdminUser();
  
  // Mặc định là CHẶN
  const [shouldBlock, setShouldBlock] = useState(true); 

  // 1. DÙNG USE LAYOUT EFFECT ĐỂ CHẶN TRƯỚC KHI VẼ HÌNH
  useLayoutEffect(() => {
    // Tạo thẻ style động để ẩn giao diện ngay lập tức
    const styleId = 'role-guard-style';
    let styleTag = document.getElementById(styleId);

    if (shouldBlock) {
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = styleId;
            styleTag.innerHTML = `
                #root, aside, nav { display: none !important; opacity: 0 !important; }
            `;
            document.head.appendChild(styleTag);
        }
    } else {
        // Nếu được phép (Admin), gỡ bỏ style chặn
        if (styleTag) {
            styleTag.remove();
        }
    }

    // Cleanup
    return () => {
        if (!shouldBlock && styleTag) styleTag.remove();
    }
  }, [shouldBlock]);

  // 2. KIỂM TRA QUYỀN
  useEffect(() => {
      if (!isLoading && user) {
          const role = (user.metadata?.fabric_role as string || "").toLowerCase();
          const email = user.email || "";
          const ALLOWED_ROLES = ['ecommerceplatformorgmsp'];
          
          // Logic check: Cho phép Admin hoặc EcomOrg
          const isAllowed = ALLOWED_ROLES.includes(role) || email.includes('admin') || email.includes('thuquynh');

          if (isAllowed) {
              setShouldBlock(false); // Mở khóa
          } else {
              setShouldBlock(true); // Giữ khóa
          }
      }
  }, [user, isLoading]);

  // 3. RENDER MÀN HÌNH CHẶN
  // Portal sẽ render ra ngoài #root, nên nó không bị ảnh hưởng bởi CSS display:none ở trên
  
  if (isLoading || !user) {
      return <BlockScreen message="Đang kiểm tra thông tin..." />;
  }

  if (shouldBlock) {
      const role = user?.metadata?.fabric_role || "Unknown";
      return <BlockScreen message={`Tài khoản ${user.email} (${role}) không được phép truy cập Dashboard.`} showLogout={true} />;
  }

  return null;
};

export const config = defineWidgetConfig({
  zone: [
      "product.list.before",
      "order.list.before",
      "customer.list.before",
      "product.details.before",
      "order.details.before",
      "price_list.list.before"
  ],
});

export default RoleGuardWidget;