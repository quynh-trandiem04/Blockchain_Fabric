// my-medusa-store/assign-sellers.js

const BACKEND_URL = "http://127.0.0.1:9000"; 
const ADMIN_EMAIL = "thuquynhliti@gmail.com";
const ADMIN_PASS = "medusa";

async function main() {
  console.log("🚀 Đang kết nối tới Medusa Admin...");

  // 1. Đăng nhập
  const authRes = await fetch(`${BACKEND_URL}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
  });

  if (!authRes.ok) {
    const errorText = await authRes.text();
    console.error("❌ Đăng nhập thất bại:", errorText);
    return;
  }

  // [FIX]: Lấy Token chính xác từ key 'token'
  const authData = await authRes.json();
  
  // Medusa có thể trả về 'token' hoặc 'access_token' tùy phiên bản/module auth
  const token = authData.token || authData.access_token; 

  // Lấy cookie dự phòng
  const rawCookie = authRes.headers.get("set-cookie");

  if (!token && !rawCookie) {
      console.error("❌ Lỗi: Không tìm thấy Token hoặc Cookie xác thực!");
      console.log("Response Data:", authData);
      return;
  }

  console.log("✅ Đăng nhập thành công!");
  
  // Tạo Header chung
  const headers = {
      "Content-Type": "application/json"
  };

  if (token) {
      console.log("🔑 Sử dụng phương thức: Bearer Token");
      headers["Authorization"] = `Bearer ${token}`;
  } else {
      console.log("🍪 Sử dụng phương thức: Cookie");
      headers["Cookie"] = rawCookie;
  }

  // 2. Lấy danh sách sản phẩm
  const prodUrl = `${BACKEND_URL}/admin/products?limit=50&fields=id,title,metadata`;
  console.log(`📡 Fetching products...`);

  const prodRes = await fetch(prodUrl, { headers });

  if (!prodRes.ok) {
      console.error("❌ Lỗi lấy sản phẩm:", await prodRes.text());
      return;
  }

  const { products } = await prodRes.json();

  if (!products || products.length === 0) {
    console.log("⚠️ Không tìm thấy sản phẩm nào.");
    return;
  }

  console.log(`📦 Tìm thấy ${products.length} sản phẩm. Đang phân bổ...`);

  // 3. Cập nhật Metadata (Phân bổ xen kẽ)
  const sellers = ["Shop_A", "Shop_B"];
  
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const assignedSeller = sellers[i % 2]; // Chẵn -> Shop_A, Lẻ -> Shop_B

    console.log(`   -> [${i+1}/${products.length}] Updating: ${product.title} => ${assignedSeller}`);

    const updateRes = await fetch(`${BACKEND_URL}/admin/products/${product.id}`, {
      method: "POST",
      headers: headers, 
      body: JSON.stringify({
        metadata: {
          seller_company_id: assignedSeller
        }
      })
    });

    if (updateRes.ok) {
        console.log(`      ✅ Success`);
    } else {
        const errText = await updateRes.text();
        console.error(`      ❌ Failed:`, errText);
    }
  }

  console.log("🎉 Hoàn tất phân bổ Seller!");
}

main();