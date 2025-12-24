// view-history.js
const { Wallets, Gateway } = require('fabric-network');
const path = require('path');
const fs = require('fs');

async function main() {
    try {
        // --- 1. NHẬP ID ĐƠN HÀNG ĐÃ XÓA MUỐN XEM ---
        const ORDER_ID_TO_VIEW = "order_01KCQSABGHJZJY39QJ0QPHYN6J_1"; 

        // --- 2. CẤU HÌNH KẾT NỐI (Dùng lại cấu hình Hardcode đã chạy được) ---
        const connectionProfile = {
            "name": "test-network-seller",
            "version": "1.0.0",
            "client": {
                "organization": "Seller",
                "connection": { "timeout": { "peer": { "endorser": "300" } } }
            },
            "organizations": {
                "Seller": {
                    "mspid": "SellerOrgMSP",
                    "peers": ["peer0.seller.com"],
                    "certificateAuthorities": ["ca.seller.com"]
                }
            },
            "peers": {
                "peer0.seller.com": {
                    "url": "grpcs://192.168.40.11:9051", // IP Máy ảo
                    "tlsCACerts": {
                        "path": "organizations/peerOrganizations/seller.com/tlsca/tlsca.seller.com-cert.pem"
                    },
                    "grpcOptions": {
                        "ssl-target-name-override": "peer0.seller.com",
                        "hostnameOverride": "peer0.seller.com"
                    }
                }
            },
            "certificateAuthorities": {
                "ca.seller.com": {
                    "url": "https://192.168.40.11:8054",
                    "httpOptions": { "verify": false }
                }
            }
        };

        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        const identityName = 'seller_admin';

        // --- 3. KẾT NỐI VÀ TRUY VẤN LỊCH SỬ ---
        const gateway = new Gateway();
        await gateway.connect(connectionProfile, {
            wallet,
            identity: identityName,
            discovery: { enabled: false, asLocalhost: false } 
        });

        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('basic');

        console.log(`🔍 Đang truy xuất lịch sử của: ${ORDER_ID_TO_VIEW}...`);
        
        // Tên hàm thường là 'GetAssetHistory' hoặc 'GetHistoryForKey'
        const result = await contract.evaluateTransaction('GetAssetHistory', ORDER_ID_TO_VIEW);
        const history = JSON.parse(result.toString());

        console.log("====================================================");
        if (history.length === 0) {
            console.log("Không tìm thấy lịch sử nào (ID chưa từng tồn tại).");
        } else {
            history.forEach((record, index) => {
                const date = new Date(record.timestamp.seconds.low * 1000).toLocaleString();
                console.log(`\n📅 Thời gian: ${date}`);
                console.log(`TxID: ${record.txId}`);
                console.log(`🔹 Hành động: ${record.isDelete ? "🗑️ ĐÃ XÓA (DELETE)" : "📝 GHI/SỬA (WRITE)"}`);
                
                if (!record.isDelete) {
                    try {
                        // Dữ liệu tại thời điểm đó
                        console.log(`Dữ liỆu:`, JSON.stringify(record.value, null, 2));
                    } catch (e) {
                        console.log(`Dữ liỆu: ${record.value}`);
                    }
                } else {
                    console.log(`Dữ liỆu: (Trống vì đã xóa)`);
                }
                console.log("---------------------------------------");
            });
        }
        console.log("====================================================");
        
        gateway.disconnect();

    } catch (error) {
        console.error(`Lỗi: ${error.message}`);
    }
}

main();