// src/scripts/import-static-identity.js
const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

async function importIdentity(wallet, label, mspId, certPath, keyDir) {
    try {
        // 1. Đọc Certificate
        const cert = fs.readFileSync(certPath).toString();

        // 2. Tìm Private Key (File trong folder keystore thường có tên ngẫu nhiên_sk)
        const keyFiles = fs.readdirSync(keyDir);
        const keyFile = keyFiles.find(f => f.endsWith('_sk'));
        if (!keyFile) throw new Error(`Không tìm thấy file _sk trong ${keyDir}`);
        
        const key = fs.readFileSync(path.join(keyDir, keyFile)).toString();

        // 3. Tạo Identity Object
        const identity = {
            credentials: {
                certificate: cert,
                privateKey: key,
            },
            mspId: mspId,
            type: 'X.509',
        };

        // 4. Lưu vào Wallet
        await wallet.put(label, identity);
        console.log(`Đã nhập thành công Identity: ${label} (${mspId})`);

    } catch (error) {
        console.error(`Lỗi nhập ${label}:`, error.message);
    }
}

async function main() {
    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    console.log(`Wallet path: ${walletPath}\n`);

    const orgsBase = path.join(process.cwd(), 'organizations', 'peerOrganizations');

    // --- 1. IMPORT ADMIN SÀN (Ecommerce) ---
    await importIdentity(
        wallet,
        'admin', // Label dùng trong code (FabricService)
        'ECommercePlatformOrgMSP', // MSP ID chuẩn
        path.join(orgsBase, 'ecommerce.com', 'users', 'Admin@ecommerce.com', 'msp', 'signcerts', 'Admin@ecommerce.com-cert.pem'),
        path.join(orgsBase, 'ecommerce.com', 'users', 'Admin@ecommerce.com', 'msp', 'keystore')
    );

    // --- 2. IMPORT ADMIN SELLER ---
    await importIdentity(
        wallet,
        'seller_admin',
        'SellerOrgMSP',
        path.join(orgsBase, 'seller.com', 'users', 'Admin@seller.com', 'msp', 'signcerts', 'Admin@seller.com-cert.pem'),
        path.join(orgsBase, 'seller.com', 'users', 'Admin@seller.com', 'msp', 'keystore')
    );

    // --- 3. IMPORT ADMIN SHIPPER ---
    await importIdentity(
        wallet,
        'shipper_admin',
        'ShipperOrgMSP',
        path.join(orgsBase, 'shipper.com', 'users', 'Admin@shipper.com', 'msp', 'signcerts', 'Admin@shipper.com-cert.pem'),
        path.join(orgsBase, 'shipper.com', 'users', 'Admin@shipper.com', 'msp', 'keystore')
    );
}

main();