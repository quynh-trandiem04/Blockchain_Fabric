// importEcommerceAdmin.js
const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

async function main() {
    try {
        // ĐƯỜNG DẪN CẦN CHỈNH SỬA CHO ĐÚNG MÁY CỦA BẠN
        const CRYPTO_PATH = path.resolve(__dirname, '..', 'my-medusa-store', 'organizations'); 
        
        const mspId = 'ECommercePlatformOrgMSP';
        const walletPath = path.join(process.cwd(), 'wallet');
        const identityLabel = 'admin'; // Tên này phải khớp với code trong fabric.ts (_getContract)

        // Path đến Admin của ECommerce Org
        // organizations/peerOrganizations/ecommerce.com/users/Admin@ecommerce.com/msp
        const adminUserPath = path.join(CRYPTO_PATH, 'peerOrganizations', 'ecommerce.com', 'users', 'Admin@ecommerce.com', 'msp');
        
        const certPath = path.join(adminUserPath, 'signcerts', 'Admin@ecommerce.com-cert.pem');
        const keyDir = path.join(adminUserPath, 'keystore');

        if (!fs.existsSync(certPath)) {
            throw new Error(`Không tìm thấy file Cert tại: ${certPath}`);
        }

        const keyFiles = fs.readdirSync(keyDir);
        const keyFile = keyFiles.find(f => f.endsWith('_sk') || f.length > 10);
        const keyPath = path.join(keyDir, keyFile);

        const cert = fs.readFileSync(certPath).toString();
        const key = fs.readFileSync(keyPath).toString();

        const wallet = await Wallets.newFileSystemWallet(walletPath);

        // Xóa cũ, ghi mới
        const exists = await wallet.get(identityLabel);
        if (exists) {
            console.log(`⚠️  Identity '${identityLabel}' đã tồn tại. Đang xóa để ghi đè...`);
            await wallet.remove(identityLabel);
        }

        const identity = {
            credentials: { certificate: cert, privateKey: key },
            mspId: mspId,
            type: 'X.509',
        };

        await wallet.put(identityLabel, identity);
        console.log(`\n✅ THÀNH CÔNG! Đã import Identity Admin Sàn: "${identityLabel}"`);

    } catch (error) {
        console.error(`\n❌ LỖI: ${error.message}`);
    }
}

main();