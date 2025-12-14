// src/scripts/enroll-helper.js

const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Cho phép cấu hình IP của máy chạy Blockchain
const FABRIC_HOST = process.env.FABRIC_HOST || '192.168.40.11'; 

async function enrollSellerIdentity(enrollmentID, companyCodeAttr) {
    try {
        const ccpPath = path.resolve(process.cwd(), 'connection-profile.yaml');
        if (!fs.existsSync(ccpPath)) {
            throw new Error(`Cannot find connection profile at: ${ccpPath}`);
        }

        // --- Xử lý file YAML ---
        const yamlContent = fs.readFileSync(ccpPath, 'utf8');
        let ccp;
        try {
            const docs = yaml.loadAll(yamlContent);
            ccp = docs.find(doc => doc && doc.organizations);
        } catch (e) {
            ccp = yaml.load(yamlContent);
        }

        if (!ccp) throw new Error("Invalid Connection Profile.");

        const caName = 'ca.seller.com'; 
        const caInfo = ccp.certificateAuthorities[caName];
        
        if (!caInfo) throw new Error(`CA '${caName}' not found.`);

        let caTLSCACerts = caInfo.tlsCACerts.pem;
        if (!caTLSCACerts && caInfo.tlsCACerts.path) {
             const certPath = path.resolve(process.cwd(), caInfo.tlsCACerts.path);
             caTLSCACerts = fs.readFileSync(certPath, 'utf8');
        }

        let caURL = caInfo.url.replace(/:\/\/[^:]+:/, `://${FABRIC_HOST}:`);
        console.log(`🔌 Connecting to CA at: ${caURL}`);
        
        const tlsOptions = {
            trustedRoots: caTLSCACerts,
            verify: false,
        };

        const CA_DOCKER_NAME = 'ca-org2'; 
        const ca = new FabricCAServices(caURL, tlsOptions, CA_DOCKER_NAME);

        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        // --- 1. Lấy quyền Admin ---
        const adminIdentity = await wallet.get('seller_admin');
        if (!adminIdentity) {
            throw new Error('⚠️ Admin "seller_admin" not found. Please run "node enrollSeller.js" first!');
        }

        const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
        const adminUser = await provider.getUserContext(adminIdentity, 'seller_admin');

        // --- 2. [FIX MỚI] Kiểm tra và Xóa User cũ nếu bị kẹt (Zombie User) ---
        // IdentityService dùng để quản lý (CRUD) các identity trên CA
        const identityService = ca.newIdentityService();
        
        try {
            // Thử lấy thông tin user xem có tồn tại không
            await identityService.getOne(enrollmentID, adminUser);
            console.log(`⚠️ User "${enrollmentID}" đã tồn tại trên CA. Đang xóa để đăng ký lại...`);
            
            // Xóa user cũ
            await identityService.delete(enrollmentID, adminUser);
            console.log(`🗑️ Đã xóa user "${enrollmentID}" khỏi CA.`);
        } catch (error) {
            // Nếu lỗi là "Identity not found" thì tốt, ta bỏ qua và tạo mới
            // Nếu lỗi khác thì in ra để debug (nhưng thường không chặn luồng chính)
        }

        // --- 3. Đăng ký User mới (Shop) ---
        console.log(`✨ Registering user "${enrollmentID}"...`);
        const secret = await ca.register({
            affiliation: '',
            enrollmentID: enrollmentID,
            role: 'client',
            attrs: [{ name: 'companyCode', value: companyCodeAttr, ecert: true }]
        }, adminUser);
        
        console.log(`🔑 Secret generated for "${enrollmentID}"`);

        // --- 4. Enroll User mới ---
        const enrollment = await ca.enroll({
            enrollmentID: enrollmentID,
            enrollmentSecret: secret
        });

        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'SellerOrgMSP', 
            type: 'X.509',
        };

        await wallet.put(enrollmentID, x509Identity);
        console.log(`✅ Wallet created successfully for "${enrollmentID}"`);

    } catch (error) {
        console.error(`❌ Enroll Failed: ${error.message}`);
        throw error; 
    }
}

module.exports = enrollSellerIdentity;