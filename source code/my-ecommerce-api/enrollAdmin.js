'use strict';

const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml'); // <-- THÊM DÒNG NÀY

// === THAY ĐỔI USERNAME CỦA BẠN TẠI ĐÂY ===
const USER_HOME = process.env.HOME || '/home/hadoopquynhthu';
// =======================================

async function main() {
    try {
        // 1. Tải connection profile
        const ccpPath = path.resolve(__dirname, 'connection-profile.yaml');
        
        // --- SỬA LỖI: Dùng yaml.load thay vì JSON.parse ---
        const ccp = yaml.load(fs.readFileSync(ccpPath, 'utf8'));
        // ---------------------------------------------

        // 2. Lấy thông tin CA của Sàn TMĐT
        const caInfo = ccp.certificateAuthorities['ca.ecommerce.com'];
        // Lưu ý: SDK Node.js có thể cần caName, hãy đảm bảo caName là chính xác
        const caTLSCACerts = caInfo.tlsCACerts.pem;
        const ca = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false }, caInfo.caName);

        // 3. Tạo một wallet mới để chứa danh tính
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // 4. Kiểm tra xem 'admin' đã tồn tại trong ví chưa
        const identity = await wallet.get('admin');
        if (identity) {
            console.log('Một danh tính cho admin "admin" đã tồn tại trong ví');
            return;
        }

        // 5. Đọc file admin-cert và admin-key (Đã được tạo bởi cryptogen ở Tuần 3)
        const adminCertPath = path.join(USER_HOME, 'my-ecommerce-network', 'organizations', 'peerOrganizations', 'ecommerce.com', 'users', 'Admin@ecommerce.com', 'msp', 'signcerts', 'Admin@ecommerce.com-cert.pem');
        const adminKeyPathDir = path.join(USER_HOME, 'my-ecommerce-network', 'organizations', 'peerOrganizations', 'ecommerce.com', 'users', 'Admin@ecommerce.com', 'msp', 'keystore');
        
        // Tìm file key (vì nó có tên ngẫu nhiên)
        const keyFiles = fs.readdirSync(adminKeyPathDir);
        const keyPath = path.join(adminKeyPathDir, keyFiles[0]); // Giả định chỉ có 1 file key

        const adminCert = fs.readFileSync(adminCertPath, 'utf8');
        const adminKey = fs.readFileSync(keyPath, 'utf8');

        // 6. Nhập danh tính vào ví
        const adminIdentity = {
            credentials: {
                certificate: adminCert,
                privateKey: adminKey,
            },
            mspId: 'ECommercePlatformOrgMSP',
            type: 'X.509',
        };

        await wallet.put('admin', adminIdentity);
        console.log('Nhập thành công danh tính "admin" vào ví');

    } catch (error) {
        console.error(`Lỗi khi nhập admin: ${error}`);
        process.exit(1);
    }
}

main();
