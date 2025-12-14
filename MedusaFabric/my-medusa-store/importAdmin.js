// importAdmin.js
const { Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const fs = require('fs');
const path = require('path');

async function main() {
    try {
        // 1. CẤU HÌNH ĐƯỜNG DẪN (HÃY KIỂM TRA KỸ ĐƯỜNG DẪN NÀY)
        // Đây là thư mục chứa crypto-config bạn đã copy từ máy ảo về
        const CRYPTO_PATH = path.resolve(__dirname, 'organizations'); 
        
        // Cấu hình Identity
        const mspId = 'SellerOrgMSP';
        const walletPath = path.join(process.cwd(), 'wallet');
        const identityLabel = 'seller_admin'; // Tên này phải khớp với code trong fabric.ts

        // Đường dẫn đến Cert và Key của Admin Seller
        // Path: organizations/peerOrganizations/seller.com/users/Admin@seller.com/msp
        const adminUserPath = path.join(CRYPTO_PATH, 'peerOrganizations', 'seller.com', 'users', 'Admin@seller.com', 'msp');
        
        const certPath = path.join(adminUserPath, 'signcerts', 'Admin@seller.com-cert.pem');
        const keyDir = path.join(adminUserPath, 'keystore');

        // 2. KIỂM TRA FILE TỒN TẠI
        if (!fs.existsSync(certPath)) {
            throw new Error(`Không tìm thấy file Cert tại: ${certPath}`);
        }

        // Tìm file Private Key (Tên file này thay đổi mỗi lần reset mạng, thường kết thúc bằng _sk)
        const keyFiles = fs.readdirSync(keyDir);
        const keyFile = keyFiles.find(f => f.endsWith('_sk') || f.length > 10); // Lấy file key
        if (!keyFile) {
            throw new Error(`Không tìm thấy file Private Key trong: ${keyDir}`);
        }
        const keyPath = path.join(keyDir, keyFile);

        console.log(`🔑 Tìm thấy Cert: ${certPath}`);
        console.log(`🔑 Tìm thấy Key:  ${keyPath}`);

        // 3. ĐỌC NỘI DUNG
        const cert = fs.readFileSync(certPath).toString();
        const key = fs.readFileSync(keyPath).toString();

        // 4. KHỞI TẠO VÍ VÀ IMPORT
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        // Xóa identity cũ nếu có
        const exists = await wallet.get(identityLabel);
        if (exists) {
            console.log(`⚠️  Identity '${identityLabel}' đã tồn tại. Đang xóa để ghi đè...`);
            await wallet.remove(identityLabel);
        }

        const identity = {
            credentials: {
                certificate: cert,
                privateKey: key,
            },
            mspId: mspId,
            type: 'X.509',
        };

        await wallet.put(identityLabel, identity);
        console.log(`\n✅ THÀNH CÔNG! Đã import trực tiếp Admin Identity vào ví: "${identityLabel}"`);
        console.log(`📂 Wallet tại: ${walletPath}`);

    } catch (error) {
        console.error(`\n❌ LỖI: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
}

main();