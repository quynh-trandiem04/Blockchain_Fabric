// src/services/fabric.ts
// @ts-nocheck

const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const yaml = require('js-yaml');

// === CẤU HÌNH ===
const KEY_PATH = path.join(process.cwd(), 'keys');
const CHANNEL_NAME = 'orderchannel';
const CC_NAME = 'ecommerce';
const VM_IP = '192.168.40.11'; 

// [QUAN TRỌNG] Thêm dòng này để fix lỗi CCP_PATH is not defined
const CCP_PATH = path.resolve(process.cwd(), 'connection-profile.yaml'); 

// Load Key Mã Hóa
let SELLER_PUBLIC_KEY = "";
let SHIPPER_PUBLIC_KEY = "";
try {
    SELLER_PUBLIC_KEY = fs.readFileSync(path.join(KEY_PATH, 'seller_public_key.pem'), 'utf8');
    SHIPPER_PUBLIC_KEY = fs.readFileSync(path.join(KEY_PATH, 'shipper_public_key.pem'), 'utf8');
} catch (e) {
    console.warn("⚠️ Warning: Chưa load được RSA Keys. Hãy kiểm tra thư mục 'keys'.");
}

// --- CERTIFICATES (COPY MỚI NHẤT TỪ UBUNTU) ---
// (Giữ nguyên các biến PEM của bạn ở đây...)
const ORDERER_PEM = `-----BEGIN CERTIFICATE-----
MIICQzCCAeqgAwIBAgIRAPg+L67lbDgvZPE54LyOA6kwCgYIKoZIzj0EAwIwbDEL
MAkGA1UEBhMCVVMxEzARBgNVBAgTCkNhbGlmb3JuaWExFjAUBgNVBAcTDVNhbiBG
cmFuY2lzY28xFDASBgNVBAoTC2V4YW1wbGUuY29tMRowGAYDVQQDExF0bHNjYS5l
eGFtcGxlLmNvbTAeFw0yNTEyMTQxNTQ5MDBaFw0zNTEyMTIxNTQ5MDBaMGwxCzAJ
BgNVBAYTAlVTMRMwEQYDVQQIEwpDYWxpZm9ybmlhMRYwFAYDVQQHEw1TYW4gRnJh
bmNpc2NvMRQwEgYDVQQKEwtleGFtcGxlLmNvbTEaMBgGA1UEAxMRdGxzY2EuZXhh
bXBsZS5jb20wWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAAR85rl5dztEhhOZ59SE
jNpURpsm1iJQ6dvf1NrOhTocyEpqOpkRqEsdO+e0D6jKbWDPP77Mzb0nYyO5GLoQ
91/7o20wazAOBgNVHQ8BAf8EBAMCAaYwHQYDVR0lBBYwFAYIKwYBBQUHAwIGCCsG
AQUFBwMBMA8GA1UdEwEB/wQFMAMBAf8wKQYDVR0OBCIEIJOd4fYI4WDoMTzc6LlP
zzYqp031Vtp9DctReU1qUgNCMAoGCCqGSM49BAMCA0cAMEQCIGdZOeHJikWVCits
3AxoOmPlboPjlmqjheWrMtaZlYMCAiAEfKEg5bra9xRsVdQr4WGvO3RagVdGyhPF
Ak/F5AfvYg==
-----END CERTIFICATE-----`;

const SELLER_PEM = `-----BEGIN CERTIFICATE-----
MIICPjCCAeWgAwIBAgIQEOKc7ETskCNmtC+8apoR5DAKBggqhkjOPQQDAjBqMQsw
CQYDVQQGEwJVUzETMBEGA1UECBMKQ2FsaWZvcm5pYTEWMBQGA1UEBxMNU2FuIEZy
YW5jaXNjbzETMBEGA1UEChMKc2VsbGVyLmNvbTEZMBcGA1UEAxMQdGxzY2Euc2Vs
bGVyLmNvbTAeFw0yNTEyMTQxNTQ5MDBaFw0zNTEyMTIxNTQ5MDBaMGoxCzAJBgNV
BAYTAlVTMRMwEQYDVQQIEwpDYWxpZm9ybmlhMRYwFAYDVQQHEw1TYW4gRnJhbmNp
c2NvMRMwEQYDVQQKEwpzZWxsZXIuY29tMRkwFwYDVQQDExB0bHNjYS5zZWxsZXIu
Y29tMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEoLPWtIo6j5Z/b4LYafsUA1UT
HEE+5tFHbMSJU3S3blscWG3v43v4gN/+ADZERNxzXf1oARx4thO6nrn9KV3PT6Nt
MGswDgYDVR0PAQH/BAQDAgGmMB0GA1UdJQQWMBQGCCsGAQUFBwMCBggrBgEFBQcD
ATAPBgNVHRMBAf8EBTADAQH/MCkGA1UdDgQiBCCfPVgR330zBmUlLkRiO3dI+2gL
GhnpTfSLb30a9bpbljAKBggqhkjOPQQDAgNHADBEAiAOZ/pFqUL/wQ9bh1gBN0tR
/w2qM7Wx7xWebE0aQX8luwIgLexCPu5Gofh32iApmWvqw24oN+MMWuVJGRWroaHt
4mk=
-----END CERTIFICATE-----`;

const ECOMMERCE_PEM = `-----BEGIN CERTIFICATE-----
MIICTDCCAfGgAwIBAgIQNTijvW/8tzXgCtpfot3A+zAKBggqhkjOPQQDAjBwMQsw
CQYDVQQGEwJVUzETMBEGA1UECBMKQ2FsaWZvcm5pYTEWMBQGA1UEBxMNU2FuIEZy
YW5jaXNjbzEWMBQGA1UEChMNZWNvbW1lcmNlLmNvbTEcMBoGA1UEAxMTdGxzY2Eu
ZWNvbW1lcmNlLmNvbTAeFw0yNTEyMTQxNTQ5MDBaFw0zNTEyMTIxNTQ5MDBaMHAx
CzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpDYWxpZm9ybmlhMRYwFAYDVQQHEw1TYW4g
RnJhbmNpc2NvMRYwFAYDVQQKEw1lY29tbWVyY2UuY29tMRwwGgYDVQQDExN0bHNj
YS5lY29tbWVyY2UuY29tMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEemvF4IoP
AoS0HmjciW8xMJxShHehKjZ7GlHewpcLiSX1RlqMbiz+WJRigqe0aB+JRA0LKaNG
D94khgpiOwCMcqNtMGswDgYDVR0PAQH/BAQDAgGmMB0GA1UdJQQWMBQGCCsGAQUF
BwMCBggrBgEFBQcDATAPBgNVHRMBAf8EBTADAQH/MCkGA1UdDgQiBCDO3GoFjWfh
kKHLaCfq5WCkDgaLsmQ/BvHGitsmrf5nnTAKBggqhkjOPQQDAgNJADBGAiEA4fzu
4F+LWO6twh64CbeqkjPPwlYLNvI+XW/pOp5K6kgCIQDc4MLuuOWxYQim+Xa2ER6p
HJ7iopSuXIsCCFx2y0uasA==
-----END CERTIFICATE-----`;

const SHIPPER_PEM = `-----BEGIN CERTIFICATE-----
MIICRTCCAeqgAwIBAgIRAIrgMELwYH2gU/9i6paxGXEwCgYIKoZIzj0EAwIwbDEL
MAkGA1UEBhMCVVMxEzARBgNVBAgTCkNhbGlmb3JuaWExFjAUBgNVBAcTDVNhbiBG
cmFuY2lzY28xFDASBgNVBAoTC3NoaXBwZXIuY29tMRowGAYDVQQDExF0bHNjYS5z
aGlwcGVyLmNvbTAeFw0yNTEyMTQxNTQ5MDBaFw0zNTEyMTIxNTQ5MDBaMGwxCzAJ
BgNVBAYTAlVTMRMwEQYDVQQIEwpDYWxpZm9ybmlhMRYwFAYDVQQHEw1TYW4gRnJh
bmNpc2NvMRQwEgYDVQQKEwtzaGlwcGVyLmNvbTEaMBgGA1UEAxMRdGxzY2Euc2hp
cHBlci5jb20wWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAAR6+MHcvvKav3Q0VHZs
QcKu6omEP8AfvS7PC9um/q3JiPjGsP7aiGo5b9dMj/Ic8fDMt8Uo30PT+c0IZPIp
vbAqo20wazAOBgNVHQ8BAf8EBAMCAaYwHQYDVR0lBBYwFAYIKwYBBQUHAwIGCCsG
AQUFBwMBMA8GA1UdEwEB/wQFMAMBAf8wKQYDVR0OBCIEIJf3xZ1W+ftkl8urCAdP
8rBYbMDAcJ/O1kExaeliCVD4MAoGCCqGSM49BAMCA0kAMEYCIQDU8LlgZrH4EZUo
7VOyjADkPLmjvSJun43afyWiH0/XRwIhAKnOBd2eWms6vbL7I8TXKihVinHnXBwH
aCTV/M/GlT8I
-----END CERTIFICATE-----`; 

// === Helper Mã Hóa ===
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

function hybridEncrypt(dataString, rsaPublicKey) {
    if (!rsaPublicKey) return ""; 
    const symmetricKey = crypto.randomBytes(KEY_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, symmetricKey, iv);
    let encryptedData = cipher.update(dataString, 'utf8', 'base64');
    encryptedData += cipher.final('base64');
    const authTag = cipher.getAuthTag();
    const encryptedKey = crypto.publicEncrypt({ 
        key: rsaPublicKey, 
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, 
        oaepHash: 'sha256' 
    }, symmetricKey);
    return JSON.stringify({ 
        iv: iv.toString('base64'), 
        authTag: authTag.toString('base64'), 
        encryptedKey: encryptedKey.toString('base64'), 
        encryptedData: encryptedData 
    });
}

function hybridDecrypt(blobString, rsaPrivateKey) {
    if (!blobString || !rsaPrivateKey) return null;
    try {
        const { iv, authTag, encryptedKey, encryptedData } = JSON.parse(blobString);
        const ivBuffer = Buffer.from(iv, 'base64');
        const authTagBuffer = Buffer.from(authTag, 'base64');
        const decryptedSymmetricKey = crypto.privateDecrypt({ 
            key: rsaPrivateKey, 
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, 
            oaepHash: 'sha256' 
        }, Buffer.from(encryptedKey, 'base64'));
        const decipher = crypto.createDecipheriv(ALGORITHM, decryptedSymmetricKey, ivBuffer);
        decipher.setAuthTag(authTagBuffer);
        let decryptedData = decipher.update(encryptedData, 'base64', 'utf8');
        decryptedData += decipher.final('utf8');
        return JSON.parse(decryptedData);
    } catch (e) {
        console.error("Decrypt Error:", e.message);
        return null;
    }
}

class FabricService {
    constructor(container) {
        this.container = container;
        this.gateways = {}; 
        this.wallet = null; 
    }

    async _getContract(role){
        let userId = 'seller_admin';
        
        if (role === 'admin') {
            userId = 'admin'; 
        } else if (role === 'shipper') {
            userId = 'shipper_admin';
        } else {
            // role === 'seller'

            if (!fs.existsSync(CCP_PATH)) {
            throw new Error(`Connection Profile not found at ${CCP_PATH}`);
            }
        }
        const yamlDocs = yaml.loadAll(fs.readFileSync(CCP_PATH, 'utf8'));
        const ccp = yamlDocs[0]; 

        if (!this.wallet) {
            const walletPath = path.join(process.cwd(), 'wallet');
            this.wallet = await Wallets.newFileSystemWallet(walletPath);
        }

        const identity = await this.wallet.get(userId);
        if (!identity) {
            console.error(`[FabricService] ❌ Identity '${userId}' not found in wallet!`);
            throw new Error(`Identity '${userId}' not found in wallet.`);
        }

        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet: this.wallet, 
            identity: userId,
            discovery: { enabled: false, asLocalhost: false } 
        });

        const network = await gateway.getNetwork(CHANNEL_NAME);
        return { contract: network.getContract(CC_NAME), gateway };
    }

    // --- Create Order ---
    async createOrder(data, sellerCompanyId){
        const { contract } = await this._getContract('seller'); 

        const sellerPayload = JSON.stringify({
            customerName: data.customerName,
            items: data.product_lines,
            amount_untaxed: data.amount_untaxed,
            amount_total: data.amount_total
        });
        const shipperPayload = JSON.stringify({
            customerName: data.customerName,
            shipping_address: data.shipping_address,
            phone: data.shipping_phone,
            cod_amount: data.cod_amount || 0
        });
        
        // Mã hóa
        const encryptedSellerBlob = hybridEncrypt(sellerPayload, data._sellerPublicKey || SELLER_PUBLIC_KEY);
        const encryptedShipperBlob = hybridEncrypt(shipperPayload, SHIPPER_PUBLIC_KEY);

       console.log(`[Fabric] Creating Order: ${data.orderID}`);
        
        try {
            const transaction = contract.createTransaction('CreateOrder');
        await transaction.submit(
            data.orderID,
            data.paymentMethod, 
            data.shipperCompanyID, 
            encryptedSellerBlob,
            encryptedShipperBlob,
            sellerCompanyId
        );
           console.log(`[Fabric] Success: ${data.orderID}`);
        return transaction.getTransactionId();
        } catch (error) {
           console.error(`[Fabric] Submit Error: ${error.message}`);
           if (error.responses) {
                error.responses.forEach(r => console.error(`   Peer: ${r.peer.name} | Status: ${r.status} | Msg: ${r.message}`));
           }
           throw error; 
        }
    }

    // --- Query & Decrypt ---
    async queryOrder(orderId, role, companyID = '') { 
        // 1. Kiểm tra Role trước
        if (!role) {
            return { error: "Role is required for querying." };
        }

        // 2. Lấy Contract (Khai báo const ở đây để dùng được cho toàn hàm)
        const { contract } = await this._getContract(role);

        try {
            // TRƯỜNG HỢP 1: Query có kiểm tra sở hữu (Seller/Shipper)
            if (companyID) {
                let mspId = '';
                if (role === 'seller') {
                    mspId = 'SellerOrgMSP';
                } else if (role === 'shipper') {
                    mspId = 'ShipperOrgMSP';
                } else {
                    throw new Error(`Invalid role '${role}' for company query.`);
                }

                console.log(`[FabricService] Executing QueryOrderForOrg: ${orderId}, ${mspId}, ${companyID}`);
                
                const result = await contract.evaluateTransaction('QueryOrderForOrg', orderId, mspId, companyID); 
                return JSON.parse(result.toString());
            }
            
            // TRƯỜNG HỢP 2: Query Admin (Hoặc query public không cần companyID)
            console.log(`[FabricService] Executing QueryOrder (Admin): ${orderId}`);
            const result = await contract.evaluateTransaction('QueryOrder', orderId);
            return JSON.parse(result.toString());

        } catch (e) {
            // console.error(`[FabricService] Query Failed for ${orderId}. Error Details:`, e.message);
            // Trả về object lỗi để API Route xử lý fallback (không throw để tránh crash app)
            return { error: e.message }; 
        }
    }

    async decryptSellerData(orderId, privateKeyOverride = null, sellerCompanyID = '') {
        try {
            console.log(`[FabricService] Querying Fabric for Order: ${orderId}`);
            const orderData = await this.queryOrder(orderId, 'seller', sellerCompanyID);
            
            if (!orderData || !orderData.seller_sensitive_data) {
                return { error: "No sensitive data found." };
            }

            const decryptionKey = privateKeyOverride || this.config.SELLER_PRIVATE;
            const decrypted = hybridDecrypt(orderData.seller_sensitive_data, decryptionKey);

            if (!decrypted) {
                return { error: "Decryption failed." };
            }
            
            // 🔥 MERGE DỮ LIỆU ĐỂ TRẢ VỀ ĐẦY ĐỦ 🔥
            return { 
                ...orderData, // Chứa status, paymentMethod, codStatus, createdAt...
                ...decrypted, // Chứa customerName, items, amount...
                decrypted_seller_data: decrypted 
            };
        } catch (e) {
            console.error(`[FabricService] ❌ Runtime Error in Decrypt: ${e.message}`);
            throw new Error(`Fabric Query/Process Error: ${e.message}`); 
        }
    }
    // =========================================================================
    // 3. WORKFLOW ACTIONS (Chuyển trạng thái)
    // =========================================================================

    // Sàn xác nhận thanh toán (Cho đơn PREPAID)
    async confirmPayment(orderId) {
        const { contract } = await this._getContract('admin');
        console.log(`[Fabric] Received ConfirmPayment request for Base ID: ${orderId}`);

        // BƯỚC 1: Tìm tất cả đơn hàng con (Split Orders) liên quan
        // Logic: Tìm các đơn có orderID bắt đầu bằng orderId gốc
        const queryString = {
            selector: {
                docType: 'Order',
                orderID: { "$regex": `^${orderId}` } // Regex: Bắt đầu bằng ID gốc
            }
        };

        const queryJSON = JSON.stringify(queryString);
        let relatedOrders = [];

        try {
            // Dùng hàm query có sẵn để tìm
            const resultBuffer = await contract.evaluateTransaction('QueryOrdersByString', queryJSON);
            const rawResults = JSON.parse(resultBuffer.toString());
            
            // Map ra danh sách ID
            relatedOrders = rawResults.map(r => ({
                id: r.Key,
                status: r.Record.status,
                paymentMethod: r.Record.paymentMethod
            }));

            console.log(`[Fabric] Found ${relatedOrders.length} sub-orders for ${orderId}:`, relatedOrders.map(o => o.id));

        } catch (e) {
            console.error(`[Fabric] Failed to query sub-orders: ${e.message}`);
            // Nếu query thất bại, fallback về việc thử confirm chính ID đó (trường hợp không tách đơn)
            relatedOrders = [{ id: orderId, status: 'UNKNOWN' }];
        }

        if (relatedOrders.length === 0) {
            throw new Error(`Order ${orderId} does not exist on Blockchain.`);
        }

        // BƯỚC 2: Duyệt và Confirm từng đơn hàng con
        const results = [];
        for (const subOrder of relatedOrders) {
            // Chỉ confirm nếu đơn hàng là PREPAID và chưa PAID
            
            try {
                console.log(`[Fabric] Confirming payment for sub-order: ${subOrder.id}...`);
                await contract.submitTransaction('ConfirmPayment', subOrder.id);
                results.push({ id: subOrder.id, status: 'SUCCESS' });
            } catch (err) {
                // Nếu lỗi do đã confirm rồi thì bỏ qua, còn lỗi khác thì log
                console.warn(`[Fabric] Failed to confirm ${subOrder.id}: ${err.message}`);
                results.push({ id: subOrder.id, status: 'FAILED', reason: err.message });
            }
        }

        // Kiểm tra nếu tất cả đều thất bại
        const successCount = results.filter(r => r.status === 'SUCCESS').length;
        if (successCount === 0 && results.length > 0) {
             // Ném lỗi của đơn đầu tiên để UI biết
             throw new Error(results[0].reason || "Failed to confirm payment for sub-orders.");
        }

        return { success: true, details: results };
    }

    // Shipper lấy hàng (Dùng chung cho cả COD và Prepaid)
    async shipOrder(orderId) {
        const { contract } = await this._getContract('shipper');
        console.log(`[Fabric] Shipper shipping order: ${orderId}`);
        await contract.submitTransaction('ShipOrder', orderId);
        return { success: true };
    }

    // Shipper giao thành công & thu tiền (Cho COD)
    async confirmCODDelivery(orderId) {
        const { contract } = await this._getContract('shipper');
        console.log(`[Fabric] Shipper confirmed COD delivery: ${orderId}`);
        await contract.submitTransaction('ConfirmCODDelivery', orderId);
        return { success: true };
    }

    // Shipper giao thành công (Cho Prepaid)
    async confirmDelivery(orderId) {
        const { contract } = await this._getContract('shipper');
        console.log(`[Fabric] Shipper confirmed delivery: ${orderId}`);
        await contract.submitTransaction('ConfirmDelivery', orderId);
        return { success: true };
    }

    // Sàn nhận tiền COD từ Shipper (Remit)
    async remitCOD(orderId) {
        const { contract } = await this._getContract('admin');
        console.log(`[Fabric] Admin confirming COD remittance: ${orderId}`);
        await contract.submitTransaction('RemitCOD', orderId);
        return { success: true };
    }

    // Thanh toán cho Seller (Payout)
    async payoutToSeller(orderId) {
        const { contract } = await this._getContract('admin');
        console.log(`[Fabric] Admin executing payout: ${orderId}`);
        await contract.submitTransaction('PayoutToSeller', orderId);
        return { success: true };
    }

    // =========================================================================
    // 4. RETURN FLOW (Trả hàng)
    // =========================================================================
    
    // Khách yêu cầu trả hàng (Sàn duyệt)
    async requestReturn(orderId) {
        const { contract } = await this._getContract('admin');
        await contract.submitTransaction('RequestReturn', orderId);
        return { success: true };
    }

    // Shipper lấy hàng trả
    async shipReturn(orderId) {
        const { contract } = await this._getContract('shipper');
        await contract.submitTransaction('ShipReturn', orderId);
        return { success: true };
    }

    // Seller nhận lại hàng
    async confirmReturnReceived(orderId) {
        const { contract } = await this._getContract('seller');
        await contract.submitTransaction('ConfirmReturnReceived', orderId);
        return { success: true };
    }

    // =========================================================================
    // 5. LISTING (Liệt kê đơn hàng từ Blockchain bằng Rich Query)
    // =========================================================================

    async listSellerOrders(sellerCompanyID) {
        const { contract } = await this._getContract('seller'); 

        // Query CouchDB bằng Rich Query (JSON Query)
        const queryString = {
            selector: {
                docType: 'Order',
                sellerCompanyID: sellerCompanyID
            }
        };
        
        // Convert query object sang string
        const queryJSON = JSON.stringify(queryString);

        console.log(`[Fabric List] Executing Rich Query: ${queryJSON}`);

        // Gọi hàm Ad-hoc Query (Querying the world state)
        // Giả định bạn có hàm QueryByString trong Chaincode Go
        let resultBuffer;
        try {
            resultBuffer = await contract.evaluateTransaction('QueryOrdersByString', queryJSON);
        } catch (e) {
            console.error(`[Fabric List] Query Error:`, e.message);
            throw new Error("QueryByString failed.");
        }
        
        // Xử lý kết quả trả về từ Chaincode (thường là mảng JSON của các record)
        const rawResults = JSON.parse(resultBuffer.toString());

        const sellerOrders = rawResults.map(record => {
            // XỬ LÝ ID: Chuyển "order_01KC..._1" thành "01KC..."
            let cleanId = record.Key;
            // Bỏ prefix "order_"
            if (cleanId.startsWith("order_")) cleanId = cleanId.substring(6); 
            // Bỏ suffix "_1" (nếu có logic suffix version)
            if (cleanId.includes("_")) cleanId = cleanId.split("_")[0];

            return {
                id: record.Key,
                display_id: cleanId,
                created_at: record.Record.createdAt,
                
                // PUBLIC DATA TẠM THỜI (Placeholder)
                // Vì Chaincode chưa public các trường này, ta để mặc định.
                // Frontend sẽ điền thông tin thật sau khi Decrypt xong.
                publicData: {
                    email: "Loading...", // Email nằm trong encrypted blob, phải chờ decrypt
                    currency_code: 'USD', 
                    total: 0, // Total cũng trong encrypted blob
                    
                    // LẤY TRỰC TIẾP TỪ BLOCKCHAIN RECORD
                    medusa_status: record.Record.status, 
                    medusa_payment: record.Record.paymentMethod,
                    cod_status: record.Record.codStatus // Thêm trường này nếu cần
            },
            
            status: "Pending", 
            decryptedData: null
            };
        });

        return sellerOrders;
    }

    // --- ADMIN: Lấy tất cả đơn hàng trên Blockchain ---
    async listAllOrdersForAdmin() {
        const { contract } = await this._getContract('admin'); 

        const queryString = { selector: { docType: 'Order' } };
        const queryJSON = JSON.stringify(queryString);
        console.log(`[Fabric Admin] List All Orders: ${queryJSON}`);

        let resultBuffer;
        try {
            resultBuffer = await contract.evaluateTransaction('QueryOrdersByString', queryJSON);
        } catch (e) {
            console.error(`[Fabric Admin] List Error:`, e.message);
            throw new Error("Failed to list orders from Blockchain.");
        }
        
        const rawResults = JSON.parse(resultBuffer.toString());

        // Format dữ liệu trả về
        const allOrders = rawResults.map(record => {
            return {
                blockchain_id: record.Key, // ID gốc trên chain (VD: order_..._1)
                created_at: record.Record.createdAt,
                status: record.Record.status,
                payment_method: record.Record.paymentMethod,
                cod_status: record.Record.codStatus || "",
                seller_id: record.Record.sellerCompanyID,
                shipper_id: record.Record.shipperCompanyID,
                // Lưu ý: Các thông tin nhạy cảm (Tên khách, Tiền) đang được mã hóa
                // Admin chỉ thấy được các trường public này
            };
        });

        // Sắp xếp mới nhất trước
        return allOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    async listShipperOrders(shipperCompanyID) {
        // 1. Kiểm tra đầu vào
        if (!shipperCompanyID) {
            console.warn("[Fabric] listShipperOrders: Missing shipperCompanyID. Returning empty list.");
            return [];
        }

        // 2. Kết nối với role Shipper
        const { contract } = await this._getContract('shipper');

        // 3. Tạo Query Selector lọc theo docType VÀ shipperCompanyID
        const queryString = {
            selector: {
                docType: 'Order',
                shipperCompanyID: shipperCompanyID // <--- LỌC THEO COMPANY CODE Ở ĐÂY
            }
        };

        const queryJSON = JSON.stringify(queryString);
        console.log(`[Fabric Shipper] Executing Query: ${queryJSON}`);

        try {
            const resultBuffer = await contract.evaluateTransaction('QueryOrdersByString', queryJSON);
            const rawResults = JSON.parse(resultBuffer.toString());
            
            // Map dữ liệu trả về
            return rawResults.map(r => ({
                blockchain_id: r.Key,
                created_at: r.Record.createdAt,
                status: r.Record.status,
                payment_method: r.Record.paymentMethod,
                shipper_id: r.Record.shipperCompanyID
            }));
        } catch (e) {
            console.error("[Fabric Shipper] List Error:", e.message);
            return [];
        }
    }    
}

module.exports = FabricService;