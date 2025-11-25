// my-medusa-store/src/admin/widgets/role-guard.tsx

import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Heading, Text, Button } from "@medusajs/ui";
import { useEffect, useState, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

// --- 1. COMPONENT MÀN HÌNH CHẶN (BLOCKER) ---
// FIX LỖI SYNTAX: Thêm 'showLogout' vào định nghĩa kiểu dữ liệu props
const BlockerOverlay = ({ message, showLogout }: { message: string; showLogout?: boolean }) => {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div 
        style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'white', zIndex: 2147483647,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            isolation: 'isolate'
        }}
    >
        {/* CSS HACK: Ẩn Sidebar, Navbar và Root */}
        <style>
            {`
               /* Ẩn tất cả UI của Medusa */
               #root, #app, .medusa-ui-app, main { display: none !important; opacity: 0 !important; }
               aside, nav, header, .ui-sidebar, .medusa-sidebar { display: none !important; width: 0 !important; }
               body { background: white !important; overflow: hidden !important; }
            `}
        </style>

        <Heading level="h1" className="text-ui-fg-error mb-4 text-3xl">⛔</Heading>
        <Heading level="h2" className="text-ui-fg-base mb-2 text-xl">TRUY CẬP BỊ TỪ CHỐI</Heading>
        <Text className="mb-6 text-gray-500 max-w-md text-center">{message}</Text>

        {/* Nút Đăng xuất (Chỉ hiện khi bị chặn) */}
        {showLogout && (
            <Button variant="danger" size="large" onClick={() => {
                document.cookie.split(";").forEach((c) => {
                    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
                });
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = "/app/login";
            }}>
                Đăng xuất ngay
            </Button>
        )}
    </div>,
    document.body
  );
};

const RoleGuardWidget = () => {
  const [status, setStatus] = useState<"loading" | "allowed" | "blocked">("loading");
  const [roleInfo, setRoleInfo] = useState("");

  // --- 2. ẨN BODY NGAY LẬP TỨC (Tránh Flash) ---
  useLayoutEffect(() => {
      const styleId = 'guard-css-hack';
      if (status !== "allowed") {
          if (!document.getElementById(styleId)) {
              const style = document.createElement('style');
              style.id = styleId;
              style.innerHTML = 'body { visibility: hidden !important; }';
              document.head.appendChild(style);
          }
      } else {
          const style = document.getElementById(styleId);
          if (style) style.remove();
          document.body.style.visibility = "visible";
      }
  }, [status]);

  // --- 3. TỰ GỌI API LẤY USER (Native Fetch) ---
  // Cách này an toàn nhất, không phụ thuộc vào thư viện medusa-react bị lỗi version
  useEffect(() => {
      const checkUser = async () => {
          try {
              // Gọi API chính thống của Medusa Admin
              const res = await fetch('/admin/users/me');
              
              if (!res.ok) {
                  // Nếu API lỗi (401/403) -> Chưa login hoặc bị chặn -> Block luôn
                  setStatus("blocked");
                  return;
              }

              const data = await res.json();
              const user = data.user;
              
              const role = (user.metadata?.fabric_role as string || "").toLowerCase();
              const email = (user.email || "").toLowerCase();
              const ALLOWED_ROLES = ['ecommerceplatformorgmsp'];
              
              // Logic Check Quyền
              const isAdmin = ALLOWED_ROLES.includes(role);

              console.log(`🛡️ [RoleGuard] User: ${email} (${role}) -> Access: ${isAdmin}`);

              if (isAdmin) {
                  setStatus("allowed");
              } else {
                  setRoleInfo(`${email} (${role})`);
                  setStatus("blocked");
              }

          } catch (err) {
              console.error("Error checking role:", err);
              setStatus("blocked");
          }
      };

      checkUser();
  }, []);

  // Nếu là Admin -> Return null (Widget biến mất -> Web hiện ra)
  if (status === "allowed") return null;

  // Nếu đang load hoặc bị block -> Hiện BlockerOverlay
  const msg = status === 'loading' 
      ? "Đang xác thực bảo mật..." 
      : `Tài khoản ${roleInfo} không có quyền truy cập Dashboard.`;

  return <BlockerOverlay message={msg} showLogout={status === 'blocked'} />;
};

// --- 4. CẤU HÌNH ZONE HỢP LỆ ---
export const config = defineWidgetConfig({
  zone: [
      "order.list.before", "order.details.before",
      "product.list.before", "product.details.before",
      "customer.list.before", "price_list.list.before"
  ],
});

export default RoleGuardWidget;