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
const VM_IP = '192.168.245.11';

// [QUAN TRỌNG] Thêm dòng này để fix lỗi CCP_PATH is not defined
const CCP_PATH = path.resolve(process.cwd(), 'connection-profile.yaml');
// Load Key Mã Hóa
let SELLER_PUBLIC_KEY = "";
let SHIPPER_PUBLIC_KEY = "";
try {
    SELLER_PUBLIC_KEY = fs.readFileSync(path.join(KEY_PATH, 'seller_public_key.pem'), 'utf8');
    SHIPPER_PUBLIC_KEY = fs.readFileSync(path.join(KEY_PATH, 'shipper_public_key.pem'), 'utf8');
} catch (e) {
    console.warn("Warning: Chưa load được RSA Keys. Hãy kiểm tra thư mục 'keys'.");
}

/// --- CERTIFICATES (COPY MỚI NHẤT TỪ UBUNTU) ---
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

    async _getContract(role) {
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
            console.error(`[FabricService] Identity '${userId}' not found in wallet!`);
            throw new Error(`Identity '${userId}' not found in wallet.`);
        }

        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet: this.wallet,
            identity: userId,
            discovery: { enabled: true, asLocalhost: false }
        });

        const network = await gateway.getNetwork(CHANNEL_NAME);
        return { contract: network.getContract(CC_NAME), gateway };
    }

    // --- Create Order ---
    async createOrder(data, sellerCompanyId, baseAmount) {
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
            cod_amount: data.cod_amount || 0,
            shipping_fee: data.shipping_total || 0
        });

        // Mã hóa dữ liệu RSA
        const encryptedSellerBlob = hybridEncrypt(sellerPayload, data._sellerPublicKey);
        const encryptedShipperBlob = hybridEncrypt(shipperPayload, data._shipperPublicKey);

        console.log(`[Fabric] Creating Order: ${data.orderID}`);

        // Khai báo biến bên ngoài để khối catch có thể truy cập nếu cần
        let transaction;

        try {
            // 1. PHẢI KHỞI TẠO TRANSACTON (Bỏ dấu // cũ của bạn)
            transaction = contract.createTransaction('CreateOrder');

            // 2. KHÔNG DÙNG setEndorsingPeers thủ công (Tránh lỗi peer0.tax.com)
            // SDK sẽ tự dùng Discovery để tìm Peer của ECommerce, Seller hoặc Shipper

            // 3. Thực hiện gửi giao dịch (Đảm bảo đủ 7 tham số theo Chaincode v7.0)
            await transaction.submit(
                data.orderID,           // 1. string
                data.paymentMethod,     // 2. string
                data.shipperCompanyID,  // 3. string
                encryptedSellerBlob,    // 4. string
                encryptedShipperBlob,   // 5. string
                sellerCompanyId,        // 6. string
                data.amount_total?.toString() // 7. baseAmount (string đại diện int64)
            );

            console.log(`[Fabric] Success: ${data.orderID}`);
            return transaction.getTransactionId();

        } catch (error) {
            console.error(`[Fabric] Submit Error: ${error.message}`);

            if (error.responses) {
                error.responses.forEach(r => {
                    const peerName = r.peer ? r.peer.name : 'Unknown Peer';
                    console.error(`   Peer: ${peerName} | Status: ${r.status} | Msg: ${r.message}`);
                });
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

            const decryptionKey = privateKeyOverride;
            const decrypted = hybridDecrypt(orderData.seller_sensitive_data, decryptionKey);

            if (!decrypted) {
                return { error: "Decryption failed." };
            }

            // MERGE Dữ LIỆU ĐỂ TRẢ Về ĐẦY ĐỦ
            return {
                ...orderData, // Chứa status, paymentMethod, codStatus, createdAt...
                ...decrypted, // Chứa customerName, items, amount...
                decrypted_seller_data: decrypted
            };
        } catch (e) {
            console.error(`[FabricService] Runtime Error in Decrypt: ${e.message}`);
            throw new Error(`Fabric Query/Process Error: ${e.message}`);
        }
    }

    async decryptShipperData(orderId, privateKeyOverride = null, shipperCompanyID = '') {
        try {
            console.log(`[FabricService] Querying Fabric for Order (Shipper): ${orderId}`);

            // 1. Query dữ liệu thô từ Blockchain (Role 'shipper' để chọn đúng identity nếu cần)
            const orderData = await this.queryOrder(orderId, 'shipper', shipperCompanyID);

            // 2. Kiểm tra xem có dữ liệu mã hóa dành riêng cho Shipper không
            if (!orderData || !orderData.shipper_sensitive_data) {
                console.warn(`[FabricService] No sensitive data found for Shipper in order ${orderId}`);
                return {
                    ...orderData,
                    warning: "No sensitive data found or access denied."
                };
            }

            // 3. Thực hiện giải mã bằng Private Key của Shipper
            const decryptionKey = privateKeyOverride;

            // Hàm hybridDecrypt này phải giống hệt hàm bạn dùng cho Seller
            const decrypted = hybridDecrypt(orderData.shipper_sensitive_data, decryptionKey);

            if (!decrypted) {
                return { error: "Decryption failed. Invalid Key or Data corrupted." };
            }

            // 4. Merge dữ liệu Public + Private đã giải mã
            return {
                ...orderData, // Chứa status, paymentMethod, codStatus, createdAt...
                ...decrypted, // Chứa customerName, shipping_address, phone, ...
                decrypted_shipper_data: decrypted
            };

        } catch (e) {
            console.error(`[FabricService] Runtime Error in Decrypt Shipper: ${e.message}`);
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

    async shipOrder(orderId, shipperCompanyID) {
        const { contract } = await this._getContract('shipper');
        console.log(`[Fabric] Shipper shipping order: ${orderId} for Company ID: ${shipperCompanyID}`);
        await contract.submitTransaction('ShipOrder', orderId, shipperCompanyID);
        return { success: true };
    }

    async confirmCODDelivery(orderId, shipperCompanyID) {
        const { contract } = await this._getContract('shipper');
        console.log(`[Fabric] Shipper confirming COD delivery: ${orderId} for Company ID: ${shipperCompanyID}`);
        await contract.submitTransaction('ConfirmCODDelivery', orderId, shipperCompanyID);
        return { success: true };
    }

    async confirmDelivery(orderId, shipperCompanyID) {
        const { contract } = await this._getContract('shipper');
        console.log(`[Fabric] Shipper confirming delivery: ${orderId} for Company ID: ${shipperCompanyID}`);
        await contract.submitTransaction('ConfirmDelivery', orderId, shipperCompanyID);
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

    // Hủy đơn hàng (Admin only, chỉ khi status = CREATED hoặc PAID)
    async cancelOrder(orderId) {
        const { contract } = await this._getContract('admin');
        console.log(`[Fabric] Admin canceling order: ${orderId}`);
        await contract.submitTransaction('CancelOrder', orderId);
        return { success: true };
    }
    // =========================================================================
    // 4. RETURN FLOW (Trả hàng)
    // =========================================================================

    // Khách yêu cầu trả hàng
    async requestReturn(orderId) {
        const { contract } = await this._getContract('admin');
        await contract.submitTransaction('RequestReturn', orderId); return { success: true };
    }

    async shipReturn(orderId, shipperCompanyID) {
        const { contract } = await this._getContract('shipper');
        console.log(`[Fabric] Shipper shipping return: ${orderId} for Company ID: ${shipperCompanyID}`);
        await contract.submitTransaction('ShipReturn', orderId, shipperCompanyID);
        return { success: true };
    }

    async confirmReturnReceived(orderId, sellerCompanyID) {
        const { contract } = await this._getContract('seller');
        console.log(`[Fabric] Seller confirming return received: ${orderId} for Company ID: ${sellerCompanyID}`);
        await contract.submitTransaction('ConfirmReturnReceived', orderId, sellerCompanyID);
        return { success: true };
    }

    // =========================================================================
    // 5. LISTING (Liệt kê đơn hàng từ Blockchain bằng Rich Query)
    // =========================================================================

    // Thay thế phần LISTING (từ dòng 324 trở đi) bằng đoạn code sau:

    // =========================================================================
    // 5. LISTING (Liệt kê đơn hàng từ Blockchain bằng Rich Query)
    // =========================================================================

    async listSellerOrders(sellerCompanyID) {
        const { contract } = await this._getContract('seller');

        const queryString = {
            selector: {
                docType: 'Order',
                sellerCompanyID: sellerCompanyID
            }
        };

        const queryJSON = JSON.stringify(queryString);
        console.log(`[Fabric List] Executing Rich Query: ${queryJSON}`);

        let resultBuffer;
        try {
            resultBuffer = await contract.evaluateTransaction('QueryOrdersByString', queryJSON);
        } catch (e) {
            console.error(`[Fabric List] Query Error:`, e.message);
            throw new Error("QueryByString failed.");
        }

        const resultString = resultBuffer.toString();
        if (!resultString || resultString === "[]" || resultString === "null") return [];

        const rawResults = JSON.parse(resultString);

        return rawResults.map(item => {
            // TỰ ĐỘNG NHẬN DIỆN CẤU TRÚC:
            // v7.0: dữ liệu nằm trực tiếp ở item
            // Bản cũ: dữ liệu nằm ở item.Record
            const order = item.Record ? item.Record : item;
            const key = item.Key ? item.Key : (order.orderID || "Unknown");

            let cleanId = key;
            if (cleanId.startsWith("order_")) cleanId = cleanId.substring(6);
            if (cleanId.includes("_")) cleanId = cleanId.split("_")[0];

            return {
                id: key,
                display_id: cleanId,
                created_at: order.createdAt,
                seller_id: order.sellerCompanyID,
                shipper_id: order.shipperCompanyID,
                history: order.history || [],
                publicData: {
                    medusa_status: order.status,
                    medusa_payment: order.paymentMethod,
                    cod_status: order.codStatus
                },
                status: order.status
            };
        });
    }

    async listAllOrdersForAdmin() {
        const { contract } = await this._getContract('admin');
        const queryString = { selector: { docType: 'Order' } };
        const queryJSON = JSON.stringify(queryString);

        let resultBuffer;
        try {
            resultBuffer = await contract.evaluateTransaction('QueryOrdersByString', queryJSON);
        } catch (e) {
            console.error(`[Fabric Admin] List Error:`, e.message);
            throw new Error("Failed to list orders from Blockchain.");
        }

        const resultString = resultBuffer.toString();
        if (!resultString || resultString === "[]" || resultString === "null") return [];

        const rawResults = JSON.parse(resultString);

        return rawResults.map(item => {
            // Nhận diện dữ liệu cũ (Record) hoặc mới (Phẳng)
            const order = item.Record ? item.Record : item;
            const key = item.Key ? item.Key : (order.orderID || "Unknown");

            return {
                blockchain_id: key,
                created_at: order.createdAt,
                status: order.status,
                payment_method: order.paymentMethod,
                seller_id: order.sellerCompanyID,
                shipper_id: order.shipperCompanyID,
                baseAmount: order.baseAmount?.toString() || "0"
            };
        });
    }

    async listShipperOrders(shipperCompanyID) {
        // Rất quan trọng: Log ID để kiểm tra Frontend gửi gì lên
        console.log(`[Fabric Shipper] Frontend requested orders for ID: "${shipperCompanyID}"`);

        if (!shipperCompanyID) {
            console.warn("[Fabric] Missing shipperCompanyID.");
            return [];
        }

        const { contract } = await this._getContract('shipper');

        // Tạo query lọc theo đúng ID công ty shipper lưu trên Blockchain
        const queryString = {
            selector: {
                docType: 'Order',
                shipperCompanyID: shipperCompanyID
            }
        };

        try {
            const resultBuffer = await contract.evaluateTransaction('QueryOrdersByString', JSON.stringify(queryString));
            const resultString = resultBuffer.toString();

            if (!resultString || resultString === "[]" || resultString === "null") {
                console.log("[Fabric Shipper] No matching orders found for this ID.");
                return [];
            }

            const rawResults = JSON.parse(resultString);

            return rawResults.map(item => {
                // Nhận diện dữ liệu v7.0 (phẳng) hoặc bản cũ (Record)
                const data = item.Record ? item.Record : item;
                const key = item.Key ? item.Key : (data.orderID || "Unknown");

                return {
                    blockchain_id: key,
                    created_at: data.createdAt,
                    status: data.status,
                    payment_method: data.paymentMethod,
                    shipper_id: data.shipperCompanyID,
                    seller_id: data.sellerCompanyID,
                    // Thêm trường để UI Shipper hiển thị (Customer, COD Status...)
                    customer_name: "Customer", // Dữ liệu này thường nằm trong khối mã hóa
                    cod_status: data.codStatus || "N/A",
                    history: data.history || []
                };
            });
        } catch (e) {
            console.error("[Fabric Shipper] Error:", e.message);
            return [];
        }
    }

    async getSubOrders(baseOrderId) {
        const { contract } = await this._getContract('admin');
        const queryString = JSON.stringify({
            selector: {
                docType: 'Order',
                orderID: { "$regex": `^${baseOrderId}` }
            }
        });

        try {
            const resultBuffer = await contract.evaluateTransaction('QueryOrdersByString', queryString);
            const resultString = resultBuffer.toString();

            if (!resultString || resultString === "[]" || resultString === "null") return [];

            const rawResults = JSON.parse(resultString);

            return rawResults.map(item => {
                const order = item.Record ? item.Record : item;
                const key = item.Key ? item.Key : (order.orderID || "Unknown");

                return {
                    blockchain_id: key,
                    status: order.status,
                    payment_method: order.paymentMethod,
                    cod_status: order.codStatus,
                    shipper_id: order.shipperCompanyID,
                    seller_id: order.sellerCompanyID,
                    updated_at: order.updatedAt || order.createdAt,
                    delivery_timestamp: order.deliveryTimestamp,
                    history: order.history || []
                };
            }).sort((a, b) => a.blockchain_id.localeCompare(b.blockchain_id));

        } catch (e) {
            console.error(`[Fabric] Get SubOrders Error:`, e.message);
            return [];
        }
    }
}

module.exports = FabricService;