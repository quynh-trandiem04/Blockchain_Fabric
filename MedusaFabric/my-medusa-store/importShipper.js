// importShipper.js
const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

async function main() {
    try {
        // ⚠️ ĐƯỜNG DẪN NÀY CẦN CHỈNH SỬA CHO ĐÚNG VỚI MÁY CỦA BẠN ⚠️
        // Trỏ đến thư mục 'organizations' trong project hyperledger fabric của bạn
        const CRYPTO_PATH = path.resolve(__dirname, 'organizations'); 
        
        // Cấu hình Shipper
        const mspId = 'ShipperOrgMSP';
        const identityLabel = 'shipper_admin';

        // Đường dẫn đến Cert và Key của Admin Shipper
        // organizations/peerOrganizations/shipper.com/users/Admin@shipper.com/msp
        const userBasePath = path.join(CRYPTO_PATH, 'peerOrganizations', 'shipper.com', 'users', 'Admin@shipper.com', 'msp');
        
        const certPath = path.join(userBasePath, 'signcerts', 'Admin@shipper.com-cert.pem'); // Hoặc file kết thúc bằng .pem
        const keyDir = path.join(userBasePath, 'keystore');

        // Kiểm tra file tồn tại
        if (!fs.existsSync(certPath)) {
            throw new Error(`❌ Không tìm thấy file Cert tại: ${certPath}\nHãy kiểm tra lại đường dẫn CRYPTO_PATH!`);
        }

        // Tìm file private key (thường có tên dài loằng ngoằng_sk)
        const keyFiles = fs.readdirSync(keyDir);
        const keyFile = keyFiles.find(f => f.endsWith('_sk') || f.length > 10);
        
        if (!keyFile) {
            throw new Error(`❌ Không tìm thấy Private Key trong: ${keyDir}`);
        }
        
        const keyPath = path.join(keyDir, keyFile);

        // Đọc nội dung
        const cert = fs.readFileSync(certPath).toString();
        const key = fs.readFileSync(keyPath).toString();

        // Kết nối Wallet
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        // Xóa cũ (nếu có) để tránh lỗi malformed
        const exists = await wallet.get(identityLabel);
        if (exists) {
            console.log(`⚠️  Identity '${identityLabel}' đã tồn tại. Đang xóa để ghi mới...`);
            await wallet.remove(identityLabel);
        }

        // Tạo Identity mới
        const identity = {
            credentials: {
                certificate: cert,
                privateKey: key,
            },
            mspId: mspId, // Quan trọng: Phải là ShipperOrgMSP
            type: 'X.509',
        };

        await wallet.put(identityLabel, identity);
        console.log(`\n✅ THÀNH CÔNG! Đã import Identity: "${identityLabel}" (MSP: ${mspId})`);
        console.log(`   👉 Wallet path: ${walletPath}`);

    } catch (error) {
        console.error(`\n❌ LỖI: ${error.message}`);
    }
}

main();