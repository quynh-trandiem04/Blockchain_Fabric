// enroll.js
const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

async function main() {
    try {
        // 1. Load Connection Profile
        const ccpPath = path.resolve(__dirname, 'connection-profile.yaml');
        if (!fs.existsSync(ccpPath)) {
            throw new Error(`Cannot find connection profile at: ${ccpPath}`);
        }
        
        // [FIX] Sử dụng logic loadAll để xử lý file YAML có nhiều document (---)
        const yamlContent = fs.readFileSync(ccpPath, 'utf8');
        const yamlDocs = yaml.loadAll(yamlContent);
        
        // Tìm object cấu hình chính (có chứa key 'organizations')
        const ccp = yamlDocs.find(doc => doc && typeof doc === 'object' && doc.organizations);

        if (!ccp) {
            throw new Error("Invalid Connection Profile: Could not find 'organizations' config.");
        }

        // 2. Cấu hình thông tin CA
        // Trong YAML bạn đặt tên là: ca.ecommerce.com
        const caName = 'ca.ecommerce.com'; 
        const caInfo = ccp.certificateAuthorities[caName];

        if (!caInfo) {
            throw new Error(`CA '${caName}' not found in connection-profile.yaml`);
        }

        // 3. Đọc TLS Certificate
        // Trong YAML mới, chúng ta đã nhúng trực tiếp 'pem', nên ưu tiên đọc nó
        let caTLSCACerts = caInfo.tlsCACerts.pem;
        
        // Fallback: Nếu không có pem mà có path (dành cho các cấu hình cũ)
        if (!caTLSCACerts && caInfo.tlsCACerts.path) {
            const certPath = path.resolve(__dirname, caInfo.tlsCACerts.path);
            if (!fs.existsSync(certPath)) {
                throw new Error(`TLS Cert not found at: ${certPath}`);
            }
            caTLSCACerts = fs.readFileSync(certPath, 'utf8');
        }

        if (!caTLSCACerts) {
            throw new Error('TLS CACerts not found in connection profile (neither pem nor path)');
        }

        // 4. Khởi tạo CA Client
        // verify: false để bỏ qua check hostname khi chạy local với IP/localhost
        const ca = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false }, null);

        // 5. Setup Wallet
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // 6. Enroll Admin
        // Kiểm tra xem đã có admin chưa
        const identity = await wallet.get('admin');
        if (identity) {
            console.log('An identity for the user "admin" already exists in the wallet');
            return;
        }

        // Enroll với ID và Secret mặc định của Fabric CA (admin / adminpw)
        const enrollment = await ca.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw' });
        
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'ECommercePlatformOrgMSP',
            type: 'X.509',
        };

        await wallet.put('admin', x509Identity);
        console.log('Successfully enrolled admin user "admin" and imported it into the wallet');

    } catch (error) {
        console.error(`Failed to enroll admin user "admin": ${error}`);
        process.exit(1);
    }
}

main();