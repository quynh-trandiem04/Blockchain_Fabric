// src/scripts/test-connection-verbose.js
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const grpc = require('@grpc/grpc-js');

// --- CẤU HÌNH ---
const CCP_PATH = path.resolve(process.cwd(), 'connection-profile.yaml');

async function main() {
    console.log("🚀 STARTING CONNECTION DIAGNOSTIC...\n");

    // 1. Kiểm tra file Connection Profile
    if (!fs.existsSync(CCP_PATH)) {
        console.error(`❌ ERROR: Connection Profile not found at ${CCP_PATH}`);
        return;
    }
    console.log(`✅ Found Connection Profile: ${CCP_PATH}`);

    let ccp;
    try {
        const fileContent = fs.readFileSync(CCP_PATH, 'utf8');
        // [FIX] Dùng loadAll để xử lý trường hợp file có dấu "---"
        const yamlDocs = yaml.loadAll(fileContent);
        // Tìm document chứa cấu hình organizations
        ccp = yamlDocs.find(doc => doc && typeof doc === 'object' && doc.organizations);
        
        if (!ccp) {
             // Fallback nếu không tìm thấy, thử load thường
             ccp = yaml.load(fileContent);
        }
        console.log(`✅ Loaded YAML successfully.`);
    } catch (e) {
        console.error(`❌ ERROR: Failed to parse YAML:`, e.message);
        return;
    }

    // 2. Test Kết nối từng Peer
    console.log("\n--- TESTING PEERS ---");
    if (ccp.peers) {
        for (const peerName in ccp.peers) {
            await testNodeConnection(peerName, ccp.peers[peerName]);
        }
    } else {
        console.warn("⚠️ No peers defined in profile.");
    }

    // 3. Test Kết nối từng Orderer
    console.log("\n--- TESTING ORDERERS ---");
    if (ccp.orderers) {
        for (const ordererName in ccp.orderers) {
            await testNodeConnection(ordererName, ccp.orderers[ordererName]);
        }
    } else {
        console.warn("⚠️ No orderers defined in profile.");
    }
}

async function testNodeConnection(name, config) {
    console.log(`\nTesting: ${name}`);
    
    // a. Kiểm tra URL & IP
    const url = config.url;
    console.log(`   URL: ${url}`);
    
    // b. Kiểm tra Cert Path
    let pemPath = config.tlsCACerts?.path;
    let pemContent = null;

    if (pemPath) {
        console.log(`   TLS Path (Raw): ${pemPath}`);
        // Nếu path bắt đầu bằng // (network path), nodejs xử lý bình thường
        try {
            if (fs.existsSync(pemPath)) {
                console.log(`   ✅ File exists.`);
                pemContent = fs.readFileSync(pemPath);
                console.log(`   ✅ File read success (Size: ${pemContent.length} bytes).`);
            } else {
                console.error(`   ❌ ERROR: File DOES NOT EXIST at path!`);
                console.error(`      -> Please check Z drive mapping or network path.`);
                return;
            }
        } catch (e) {
            console.error(`   ❌ ERROR reading file: ${e.message}`);
            return;
        }
    } else if (config.tlsCACerts?.pem) {
        console.log(`   ✅ TLS Cert provided as PEM string (Hardcoded).`);
        pemContent = Buffer.from(config.tlsCACerts.pem);
    } else {
        console.error(`   ❌ ERROR: No TLS Certificate found (path or pem missing).`);
        return;
    }

    // c. Test gRPC Connection (Low-level)
    const target = url.replace('grpcs://', '').replace('grpc://', '');
    
    // Tạo SSL Credential từ nội dung file đã đọc được
    const sslCreds = grpc.credentials.createSsl(pemContent);
    
    // Override Hostname để khớp với chứng chỉ
    const options = {
        'grpc.ssl_target_name_override': config.grpcOptions?.['ssl-target-name-override'] || name,
        'grpc.default_authority': config.grpcOptions?.['ssl-target-name-override'] || name
    };

    console.log(`   Target Override: ${options['grpc.ssl_target_name_override']}`);

    return new Promise((resolve) => {
        const client = new grpc.Client(target, sslCreds, options);
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + 5); // 5s timeout

        console.log(`   ⏳ Connecting gRPC...`);
        
        client.waitForReady(deadline, (err) => {
            if (err) {
                console.error(`   ❌ CONNECTION FAILED: ${err.message}`);
                // Phân tích lỗi
                if (err.message.includes('14')) console.error("      -> Có thể do lỗi mạng (Firewall, IP sai, Port sai) hoặc Server chưa bật.");
                if (err.message.includes('Handshake')) console.error("      -> Lỗi SSL Handshake (Cert sai, Hostname override sai).");
            } else {
                console.log(`   ✅ CONNECTION SUCCESSFUL! (gRPC Ready)`);
            }
            client.close();
            resolve();
        });
    });
}

main();