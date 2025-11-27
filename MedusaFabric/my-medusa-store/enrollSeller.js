// enrollSeller.js
'use strict';

const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

// === CẤU HÌNH ===
// Thay đổi đường dẫn này trỏ tới thư mục chứa crypto-config của bạn
const CRYPTO_PATH = path.resolve(__dirname, 'organizations'); 
// Tên định danh trong wallet (sẽ dùng trong fabric.js)
const IDENTITY_LABEL = 'seller_admin';
const MSP_ID = 'SellerOrgMSP';
const ORG_DOMAIN = 'seller.com';
const ADMIN_USER = 'Admin@seller.com';

async function main() {
    try {
        // 1. Tạo/Mở wallet
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`📂 Wallet path: ${walletPath}`);

        // 2. Kiểm tra xem đã có chưa
        const identity = await wallet.get(IDENTITY_LABEL);
        if (identity) {
            console.log(`✅ Danh tính "${IDENTITY_LABEL}" đã tồn tại.`);
            return;
        }

        // 3. Đọc Cert và Key từ thư mục crypto-config (được tạo bởi cryptogen/CA)
        // Đường dẫn chuẩn: organizations/peerOrganizations/seller.com/users/Admin@seller.com/msp/...
        const certPath = path.join(CRYPTO_PATH, 'peerOrganizations', ORG_DOMAIN, 'users', ADMIN_USER, 'msp', 'signcerts', `${ADMIN_USER}-cert.pem`);
        const keyDir = path.join(CRYPTO_PATH, 'peerOrganizations', ORG_DOMAIN, 'users', ADMIN_USER, 'msp', 'keystore');

        if (!fs.existsSync(certPath)) {
            throw new Error(`❌ Không tìm thấy Cert tại: ${certPath}`);
        }

        // Tìm file Private Key (tên ngẫu nhiên _sk)
        const keyFiles = fs.readdirSync(keyDir);
        const keyFile = keyFiles.find(f => f.endsWith('_sk') || f.length > 10); // Lấy file key
        if (!keyFile) {
            throw new Error(`❌ Không tìm thấy Private Key trong: ${keyDir}`);
        }
        const keyPath = path.join(keyDir, keyFile);

        const certificate = fs.readFileSync(certPath, 'utf8');
        const privateKey = fs.readFileSync(keyPath, 'utf8');

        // 4. Tạo Identity Object
        const x509Identity = {
            credentials: {
                certificate: certificate,
                privateKey: privateKey,
            },
            mspId: MSP_ID,
            type: 'X.509',
        };

        // 5. Lưu vào Wallet
        await wallet.put(IDENTITY_LABEL, x509Identity);
        console.log(`🎉 Thành công! Đã thêm "${IDENTITY_LABEL}" vào wallet.`);

    } catch (error) {
        console.error(`❌ Lỗi enroll Seller: ${error}`);
        process.exit(1);
    }
}

main();