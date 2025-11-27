// enrollShipper.js
'use strict';

const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

// === CẤU HÌNH ===
const CRYPTO_PATH = path.resolve(__dirname, 'organizations'); 
const IDENTITY_LABEL = 'shipper_admin';
const MSP_ID = 'ShipperOrgMSP';
const ORG_DOMAIN = 'shipper.com';
const ADMIN_USER = 'Admin@shipper.com';

async function main() {
    try {
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`📂 Wallet path: ${walletPath}`);

        const identity = await wallet.get(IDENTITY_LABEL);
        if (identity) {
            console.log(`✅ Danh tính "${IDENTITY_LABEL}" đã tồn tại.`);
            return;
        }

        const certPath = path.join(CRYPTO_PATH, 'peerOrganizations', ORG_DOMAIN, 'users', ADMIN_USER, 'msp', 'signcerts', `${ADMIN_USER}-cert.pem`);
        const keyDir = path.join(CRYPTO_PATH, 'peerOrganizations', ORG_DOMAIN, 'users', ADMIN_USER, 'msp', 'keystore');

        if (!fs.existsSync(certPath)) {
            throw new Error(`❌ Không tìm thấy Cert tại: ${certPath}`);
        }

        const keyFiles = fs.readdirSync(keyDir);
        const keyFile = keyFiles.find(f => f.endsWith('_sk') || f.length > 10);
        if (!keyFile) throw new Error(`❌ Không tìm thấy Private Key trong: ${keyDir}`);
        
        const keyPath = path.join(keyDir, keyFile);
        const certificate = fs.readFileSync(certPath, 'utf8');
        const privateKey = fs.readFileSync(keyPath, 'utf8');

        const x509Identity = {
            credentials: {
                certificate: certificate,
                privateKey: privateKey,
            },
            mspId: MSP_ID,
            type: 'X.509',
        };

        await wallet.put(IDENTITY_LABEL, x509Identity);
        console.log(`🎉 Thành công! Đã thêm "${IDENTITY_LABEL}" vào wallet.`);

    } catch (error) {
        console.error(`❌ Lỗi enroll Shipper: ${error}`);
        process.exit(1);
    }
}

main();