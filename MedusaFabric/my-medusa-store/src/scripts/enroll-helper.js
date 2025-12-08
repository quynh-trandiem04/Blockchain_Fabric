// src/scripts/enroll-helper.js

const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Cho phép cấu hình IP của máy chạy Blockchain
const FABRIC_HOST = process.env.FABRIC_HOST || '192.168.40.11'; // IP máy Ubuntu của bạn

async function enrollSellerIdentity(enrollmentID, companyCodeAttr) {
    try {
        const ccpPath = path.resolve(process.cwd(), 'connection-profile.yaml');
        if (!fs.existsSync(ccpPath)) {
            throw new Error(`Cannot find connection profile at: ${ccpPath}`);
        }
        const ccp = yaml.load(fs.readFileSync(ccpPath, 'utf8'));

        // Lấy thông tin config gốc
        const caInfo = ccp.certificateAuthorities['ca.seller.com'];
        const caTLSCACerts = caInfo.tlsCACerts.pem;   

        // 1. Thay thế Hostname
        let caURL = caInfo.url.replace(/:\/\/[^:]+:/, `://${FABRIC_HOST}:`);
        console.log(`🔌 Connecting to CA at: ${caURL}`);
        
        const tlsOptions = {
            trustedRoots: caTLSCACerts,
            verify: false,
            checkServerIdentity: () => { return undefined; }
        };

        // 2. [FIX LỖI TẠI ĐÂY]: Thay caInfo.caName bằng tên chuẩn 'ca-org2'
        // Server Docker được cấu hình là 'ca-org2', không phải 'ca.seller.com'
        const CA_NAME_CORRECT = 'ca-org2'; 

        const ca = new FabricCAServices(caURL, tlsOptions, CA_NAME_CORRECT);

        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        // Check Admin
        const adminIdentity = await wallet.get('seller_admin');
        if (!adminIdentity) {
            console.log('⚠️ Admin "seller_admin" missing. Auto-enrolling...');
            try {
                const enrollment = await ca.enroll({ 
                    enrollmentID: 'admin', 
                    enrollmentSecret: 'adminpw' 
                });
                const x509Identity = {
                    credentials: {
                        certificate: enrollment.certificate,
                        privateKey: enrollment.key.toBytes(),
                    },
                    mspId: 'SellerOrgMSP',
                    type: 'X.509',
                };
                await wallet.put('seller_admin', x509Identity);
                console.log('✅ Admin "seller_admin" enrolled.');
            } catch (err) {
                throw new Error(`❌ Failed to auto-enroll admin: ${err.message}`);
            }
        }

        const finalAdminIdentity = await wallet.get('seller_admin');
        const provider = wallet.getProviderRegistry().getProvider(finalAdminIdentity.type);
        const adminUser = await provider.getUserContext(finalAdminIdentity, 'seller_admin');

        // Đăng ký User
        let secret;
        try {
            secret = await ca.register({
                affiliation: '',
                enrollmentID: enrollmentID,
                role: 'client',
                attrs: [{ name: 'companyCode', value: companyCodeAttr, ecert: true }]
            }, adminUser);
            console.log(`✨ Registered user "${enrollmentID}"`);
        } catch (regError) {
            if (regError.toString().includes('already registered')) {
                console.warn(`⚠️ User "${enrollmentID}" đã tồn tại trên CA.`);
                // Nếu đã tồn tại mà chưa có wallet, ta buộc phải báo lỗi vì không lấy lại được secret
                // Trừ khi bạn đã lưu secret ở đâu đó, hoặc admin cũ đã bị xóa.
                // Để test tiếp, hãy dùng tên Shop khác.
                throw new Error(`User "${enrollmentID}" đã tồn tại. Hãy tạo Shop với tên khác!`);
            } else {
                throw regError;
            }
        }

        // Enroll
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
        console.log(`✅ Wallet created for "${enrollmentID}"`);

    } catch (error) {
        console.error(`❌ Enroll Failed: ${error.message}`);
        throw error; 
    }
}

module.exports = enrollSellerIdentity;