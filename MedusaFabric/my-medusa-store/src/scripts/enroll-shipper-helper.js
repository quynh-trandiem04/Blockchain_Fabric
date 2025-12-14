// src/scripts/enroll-shipper-helper.js

const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const FABRIC_HOST = process.env.FABRIC_HOST || '192.168.40.11'; 

async function enrollShipperIdentity(enrollmentID, companyCodeAttr) {
    try {
        const ccpPath = path.resolve(process.cwd(), 'connection-profile.yaml');
        if (!fs.existsSync(ccpPath)) {
            throw new Error(`Cannot find connection profile at: ${ccpPath}`);
        }

        const yamlContent = fs.readFileSync(ccpPath, 'utf8');
        let ccp;
        try {
            const docs = yaml.loadAll(yamlContent);
            ccp = docs.find(doc => doc && doc.organizations);
        } catch (e) {
            ccp = yaml.load(yamlContent);
        }

        if (!ccp) throw new Error("Invalid Connection Profile.");

        const caName = 'ca.shipper.com'; 
        const caInfo = ccp.certificateAuthorities[caName];
        
        if (!caInfo) throw new Error(`CA '${caName}' not found in connection profile.`);

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

        // --- [FIX LỖI TẠI ĐÂY] ---
        // Đặt là null để client tự động lấy CA mặc định của server
        // Thay vì bắt buộc tên phải là 'ca.shipper.com'
        const CA_DOCKER_NAME = null; 
        
        const ca = new FabricCAServices(caURL, tlsOptions, CA_DOCKER_NAME);

        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        // --- 1. Check Admin (shipper_admin) ---
        const adminIdentity = await wallet.get('shipper_admin');
        if (!adminIdentity) {
            throw new Error('⚠️ Admin "shipper_admin" not found. Please run "node enrollShipper.js" first!');
        }

        const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
        const adminUser = await provider.getUserContext(adminIdentity, 'shipper_admin');

        // --- 2. Xóa User cũ nếu bị kẹt ---
        const identityService = ca.newIdentityService();
        try {
            await identityService.getOne(enrollmentID, adminUser);
            console.log(`⚠️ User "${enrollmentID}" đã tồn tại trên CA. Đang xóa để đăng ký lại...`);
            await identityService.delete(enrollmentID, adminUser);
            console.log(`🗑️ Đã xóa user "${enrollmentID}" khỏi CA.`);
        } catch (error) { }

        // --- 3. Đăng ký User mới ---
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
            mspId: 'ShipperOrgMSP', 
            type: 'X.509',
        };

        await wallet.put(enrollmentID, x509Identity);
        console.log(`✅ Wallet created successfully for "${enrollmentID}"`);

    } catch (error) {
        console.error(`❌ Enroll Failed: ${error.message}`);
        throw error; 
    }
}

module.exports = enrollShipperIdentity;