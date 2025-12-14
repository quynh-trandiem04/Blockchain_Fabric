// enrollSeller.js
'use strict';

const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Cấu hình
const IDENTITY_LABEL = 'seller_admin';
const MSP_ID = 'SellerOrgMSP';
const FABRIC_HOST = process.env.FABRIC_HOST || '192.168.40.11'; 

async function main() {
    try {
        // 1. Load Connection Profile để lấy thông tin CA chính xác
        const ccpPath = path.resolve(__dirname, 'connection-profile.yaml');
        const yamlContent = fs.readFileSync(ccpPath, 'utf8');
        
        let ccp;
        try {
            const docs = yaml.loadAll(yamlContent);
            ccp = docs.find(doc => doc && doc.organizations);
        } catch (e) {
            ccp = yaml.load(yamlContent);
        }

        const caInfo = ccp.certificateAuthorities['ca.seller.com'];
        if (!caInfo) throw new Error("CA Seller not found in profile");

        // Lấy certificate (ưu tiên từ pem nếu có, không thì đọc path)
        let caTLSCACerts = caInfo.tlsCACerts.pem;
        if (!caTLSCACerts && caInfo.tlsCACerts.path) {
             caTLSCACerts = fs.readFileSync(path.resolve(__dirname, caInfo.tlsCACerts.path), 'utf8');
        }

        const caURL = caInfo.url.replace(/:\/\/[^:]+:/, `://${FABRIC_HOST}:`);
        console.log(`🔌 Connecting to CA: ${caURL}`);

        // 2. Kết nối CA
        const ca = new FabricCAServices(caURL, { trustedRoots: caTLSCACerts, verify: false }, null);

        // 3. Setup Wallet
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`📂 Wallet path: ${walletPath}`);

        // 4. Enroll Admin (admin / adminpw là mặc định của Fabric CA)
        // Lưu ý: Nếu Admin này đã enroll rồi mà bị lỗi auth, cần enroll lại để lấy cert mới
        console.log('⏳ Enrolling admin...');
        const enrollment = await ca.enroll({ 
            enrollmentID: 'admin', 
            enrollmentSecret: 'adminpw' 
        });

        // 5. Lưu vào Wallet
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: MSP_ID,
            type: 'X.509',
        };

        await wallet.put(IDENTITY_LABEL, x509Identity);
        console.log(`✅ Successfully enrolled admin user "${IDENTITY_LABEL}"`);

    } catch (error) {
        console.error(`❌ Failed to enroll admin user "${IDENTITY_LABEL}": ${error}`);
        process.exit(1);
    }
}

main();