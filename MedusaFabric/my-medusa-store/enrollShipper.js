// enrollShipper.js
'use strict';

const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Cấu hình
const IDENTITY_LABEL = 'shipper_admin';
const MSP_ID = 'ShipperOrgMSP'; // Phải khớp với configtx.yaml
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

        const caInfo = ccp.certificateAuthorities['ca.shipper.com'];
        const caTLSCACerts = caInfo.tlsCACerts.pem;
        const caURL = caInfo.url.replace(/:\/\/[^:]+:/, `://${FABRIC_HOST}:`);

        // 2. Kết nối CA
        const ca = new FabricCAServices(caURL, { trustedRoots: caTLSCACerts, verify: false }, null);

        // 3. Setup Wallet
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`📂 Wallet path: ${walletPath}`);

        // 4. Enroll Admin (admin / adminpw là mặc định của Fabric CA)
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
        console.log(`✅ Successfully enrolled admin user "${IDENTITY_LABEL}" and imported it into the wallet`);

    } catch (error) {
        console.error(`❌ Failed to enroll admin user "${IDENTITY_LABEL}": ${error}`);
        process.exit(1);
    }
}

main();