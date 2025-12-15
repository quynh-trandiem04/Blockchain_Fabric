#!/bin/bash

# Thiết lập chế độ dừng script nếu có lỗi xảy ra
set -eu

# ====================================================================
# I. THIẾT LẬP CÁC BIẾN MÔI TRƯỜNG CẬP NHẬT (HOST LEVEL)
# ====================================================================

export CC_NAME="ecommerce"
export NEW_VERSION="1.0" # PHIÊN BẢN MỚI
export NEW_SEQUENCE="2"  # SEQUENCE MỚI (PHẢI TĂNG SAU MỖI LẦN THẤT BẠI COMMIT)
export CC_DIR_IN_CLI="/opt/gopath/src/github.com/hyperledger/fabric/peer/" 
export CHANNEL_NAME="orderchannel"
export TEMP_SCRIPT="update_temp.sh"

echo "====================================================="
echo "  BẮT ĐẦU CẬP NHẬT CHAINCODE: V${NEW_VERSION} (SEQ ${NEW_SEQUENCE})"
echo "====================================================="

# ====================================================================
# II. COPY MÃ NGUỒN VÀO CONTAINER CLI
# ====================================================================
echo "📦 1. Copy mã nguồn Chaincode mới vào Container CLI..."

if [ ! -f "main.go" ] || [ ! -f "model.go" ] || [ ! -f "smartcontract.go" ]; then
    echo "LỖI: Không tìm thấy file Chaincode. Vui lòng đặt script và các file .go đã sửa vào cùng thư mục."
    exit 1
fi

docker cp main.go cli:${CC_DIR_IN_CLI}
docker cp model.go cli:${CC_DIR_IN_CLI}
docker cp smartcontract.go cli:${CC_DIR_IN_CLI}
docker cp go.mod cli:${CC_DIR_IN_CLI}
if [ -f "go.sum" ]; then
    docker cp go.sum cli:${CC_DIR_IN_CLI}
fi
echo "✅ Copy mã nguồn thành công."

# ====================================================================
# III. TẠO VÀ CHẠY SCRIPT TẠM THỜI BÊN TRONG CONTAINER
# ====================================================================

echo "🚀 2. Tạo và Thực thi Script Tạm thời BÊN TRONG Container CLI..."

# Khối lệnh Bash được xây dựng để sử dụng bên trong Container
cat <<EOF > ${TEMP_SCRIPT}
set -eu

# --- KHỞI TẠO BIẾN TỪ MÔI TRƯỜNG HOST ---
export CC_NAME=${CC_NAME}
export NEW_VERSION=${NEW_VERSION}
export NEW_SEQUENCE=${NEW_SEQUENCE}
export CC_DIR_IN_CLI=${CC_DIR_IN_CLI}
export CHANNEL_NAME=${CHANNEL_NAME}

# Định nghĩa các biến đường dẫn nội bộ
export CC_DIR=\${CC_DIR_IN_CLI}
export ORDERER_CA=\${CC_DIR}organizations/ordererOrganizations/example.com/orderers/orderer0.example.com/msp/tlscacerts/tlsca.example.com-cert.pem

# Bổ sung biến Client TLS (Cert/Key) cho Orderer (Dùng Admin ECommerce)
export CORE_PEER_TLS_CLIENTCERT_FILE=\${CC_DIR}organizations/peerOrganizations/ecommerce.com/users/Admin@ecommerce.com/tls/client.crt
export CORE_PEER_TLS_CLIENTKEY_FILE=\${CC_DIR}organizations/peerOrganizations/ecommerce.com/users/Admin@ecommerce.com/tls/client.key


# --- HÀM THIẾT LẬP MÔI TRƯỜNG NỘI BỘ ---
set_env_ecommerce() {
    export CORE_PEER_LOCALMSPID='ECommercePlatformOrgMSP'
    export CORE_PEER_TLS_ROOTCERT_FILE=\${CC_DIR}organizations/peerOrganizations/ecommerce.com/peers/peer0.ecommerce.com/tls/ca.crt
    export CORE_PEER_MSPCONFIGPATH=\${CC_DIR}organizations/peerOrganizations/ecommerce.com/users/Admin@ecommerce.com/msp
    export CORE_PEER_ADDRESS=peer0.ecommerce.com:7051
    export CORE_PEER_TLS_SERVERHOSTOVERRIDE=peer0.ecommerce.com
    export CORE_PEER_TLS_ENABLED=true
}

set_env_seller() {
    export CORE_PEER_LOCALMSPID='SellerOrgMSP'
    export CORE_PEER_TLS_ROOTCERT_FILE=\${CC_DIR}organizations/peerOrganizations/seller.com/peers/peer0.seller.com/tls/ca.crt
    export CORE_PEER_MSPCONFIGPATH=\${CC_DIR}organizations/peerOrganizations/seller.com/users/Admin@seller.com/msp
    export CORE_PEER_ADDRESS=peer0.seller.com:9051
    export CORE_PEER_TLS_SERVERHOSTOVERRIDE=peer0.seller.com
    export CORE_PEER_TLS_ENABLED=true
}

set_env_shipper() {
    export CORE_PEER_LOCALMSPID='ShipperOrgMSP'
    export CORE_PEER_TLS_ROOTCERT_FILE=\${CC_DIR}organizations/peerOrganizations/shipper.com/peers/peer0.shipper.com/tls/ca.crt
    export CORE_PEER_MSPCONFIGPATH=\${CC_DIR}organizations/peerOrganizations/shipper.com/users/Admin@shipper.com/msp
    export CORE_PEER_ADDRESS=peer0.shipper.com:11051
    export CORE_PEER_TLS_SERVERHOSTOVERRIDE=peer0.shipper.com
    export CORE_PEER_TLS_ENABLED=true
}

cd \${CC_DIR}

# --- 3. ĐÓNG GÓI (PACKAGE) ---
echo -e "\n--- 3. Đóng gói v\${NEW_VERSION} ---"
go mod tidy
peer lifecycle chaincode package \${CC_NAME}_v\${NEW_VERSION}.tar.gz --path . --lang golang --label \${CC_NAME}_\${NEW_VERSION}
echo "✅ Đóng gói OK."


# --- 4. CÀI ĐẶT (INSTALL) ---
echo -e "\n--- 4. Cài đặt v\${NEW_VERSION} lên 3 Peer (Timeout 10s) ---"
export CORE_CONN_TIMEOUT=10s # Tăng thời gian chờ

# Thêm || true để bỏ qua lỗi "Chaincode already installed"
echo "  -> Cài đặt lên Peer0 ECommerce..."
set_env_ecommerce
peer lifecycle chaincode install \${CC_NAME}_v\${NEW_VERSION}.tar.gz --peerAddresses peer0.ecommerce.com:7051 --tlsRootCertFiles \${CORE_PEER_TLS_ROOTCERT_FILE} --connTimeout 10s || true

echo "  -> Cài đặt lên Peer0 Seller..."
set_env_seller
peer lifecycle chaincode install \${CC_NAME}_v\${NEW_VERSION}.tar.gz --peerAddresses peer0.seller.com:9051 --tlsRootCertFiles \${CORE_PEER_TLS_ROOTCERT_FILE} --connTimeout 10s || true

echo "  -> Cài đặt lên Peer0 Shipper..."
set_env_shipper
peer lifecycle chaincode install \${CC_NAME}_v\${NEW_VERSION}.tar.gz --peerAddresses peer0.shipper.com:11051 --tlsRootCertFiles \${CORE_PEER_TLS_ROOTCERT_FILE} --connTimeout 10s || true
echo "✅ Install OK."


# --- 5. LẤY PACKAGE ID MỚI ---
set_env_ecommerce # Dùng Peer ECommerce để Query

# Lọc: Query ra plain text, tìm dòng chứa Label mới, trích xuất ID (trường thứ 3)
export CC_PACKAGE_ID=\$(peer lifecycle chaincode queryinstalled 2>&1 | grep "Label: \${CC_NAME}_\${NEW_VERSION}" | awk -F'[, ]' '{print \$3}' | head -n 1)

echo "  -> Package ID mới: \${CC_PACKAGE_ID}"
if [ -z "\${CC_PACKAGE_ID}" ]; then
    echo "LỖẼI: Không lấy được Package ID. Dừng lại."
    exit 1
fi


# --- 6. PHÊ DUYỆT (APPROVE) ---
echo -e "\n--- 6. Phê duyệt (Approve) Sequence \${NEW_SEQUENCE} ---"

for ORG in ecommerce seller shipper; do
    set_env_\${ORG}
    peer lifecycle chaincode approveformyorg -o orderer0.example.com:7050 --ordererTLSHostnameOverride orderer0.example.com --tls --cafile \${ORDERER_CA} \
    --certfile \${CORE_PEER_TLS_CLIENTCERT_FILE} \
    --keyfile \${CORE_PEER_TLS_CLIENTKEY_FILE} \
    --channelID \${CHANNEL_NAME} --name \${CC_NAME} --version \${NEW_VERSION} --package-id \${CC_PACKAGE_ID} --sequence \${NEW_SEQUENCE} --init-required
    echo "  ✅ Approve \${ORG} OK"
done


# --- 7. TRIỂN KHAI (COMMIT) ---
echo -e "\n--- 7. Triển khai (Commit) v\${NEW_VERSION} ---"
set_env_ecommerce # Sử dụng Admin ECommerce để ký Commit

# SỬA LỖI QUAN TRỌNG: Xóa Hostname Override để CLI có thể kết nối nhiều Peer khác nhau
unset CORE_PEER_TLS_SERVERHOSTOVERRIDE

PEER_ADDRESSES="peer0.ecommerce.com:7051 peer0.seller.com:9051 peer0.shipper.com:11051"
PEER_TLS_ROOT_CERTS_FILES="\${CC_DIR}organizations/peerOrganizations/ecommerce.com/peers/peer0.ecommerce.com/tls/ca.crt \${CC_DIR}organizations/peerOrganizations/seller.com/peers/peer0.seller.com/tls/ca.crt \${CC_DIR}organizations/peerOrganizations/shipper.com/peers/peer0.shipper.com/tls/ca.crt"

COMMIT_ARGS=""
for PEER_ADDR in \${PEER_ADDRESSES}; do
    PEER_NAME=\$(echo \${PEER_ADDR} | cut -d':' -f1)
    CERT_FILE=\$(echo \${PEER_TLS_ROOT_CERTS_FILES} | tr ' ' '\n' | grep \${PEER_NAME} | head -n 1) 
    COMMIT_ARGS+="--peerAddresses \${PEER_ADDR} --tlsRootCertFiles \${CERT_FILE} "
done

peer lifecycle chaincode commit -o orderer0.example.com:7050 \
  --ordererTLSHostnameOverride orderer0.example.com \
  --tls \
  --cafile \${ORDERER_CA} \
  --certfile \${CORE_PEER_TLS_CLIENTCERT_FILE} \
  --keyfile \${CORE_PEER_TLS_CLIENTKEY_FILE} \
  --channelID \${CHANNEL_NAME} \
  --name \${CC_NAME} \
  --version \${NEW_VERSION} \
  --sequence \${NEW_SEQUENCE} \
  --init-required \
  --clientauth \
  --waitForEventTimeout 60s \
  \${COMMIT_ARGS}


# --- 8. KHỞI TẠO (INVOKE INIT) ---
echo -e "\n--- 8. Khởi tạo Chaincode (Invoke InitLedger) ---"
set_env_ecommerce # Dùng Peer ECommerce để gọi

# BẮT BUỘC: Xóa Hostname Override trước Invoke (lỗi giống Commit)
unset CORE_PEER_TLS_SERVERHOSTOVERRIDE

# Xây dựng peerAddresses cho Invoke
INVOKE_PEER_ARGS=""
for PEER_ADDR in \${PEER_ADDRESSES}; do
    PEER_NAME=\$(echo \${PEER_ADDR} | cut -d':' -f1)
    CERT_FILE=\$(echo \${PEER_TLS_ROOT_CERTS_FILES} | tr ' ' '\n' | grep \${PEER_NAME} | head -n 1)
    INVOKE_PEER_ARGS+="--peerAddresses \${PEER_ADDR} --tlsRootCertFiles \${CERT_FILE} "
done

peer chaincode invoke -o orderer0.example.com:7050 \
  --ordererTLSHostnameOverride orderer0.example.com \
  --tls \
  --cafile \${ORDERER_CA} \
  --certfile \${CORE_PEER_TLS_CLIENTCERT_FILE} \
  --keyfile \${CORE_PEER_TLS_CLIENTKEY_FILE} \
  --channelID \${CHANNEL_NAME} \
  --name \${CC_NAME} \
  \${INVOKE_PEER_ARGS} \
  --isInit \
  -c '{"Args":["InitLedger"]}'

echo "✅ Chaincode đã được khởi tạo thành công (InitLedger invoked)."


echo -e "\n🎉 HOÀN TẤT CẬP NHẬT CHAINCODE V\${NEW_VERSION} (SEQ \${NEW_SEQUENCE})!"
EOF

# Copy script tạm thời vào Container
docker cp ${TEMP_SCRIPT} cli:/tmp/${TEMP_SCRIPT}

# Cấp quyền và chạy script bên trong Container
docker exec cli bash -c "chmod +x /tmp/${TEMP_SCRIPT} && /tmp/${TEMP_SCRIPT}"

# Dọn dẹp script tạm thời
rm -f ${TEMP_SCRIPT}

echo "====================================================="
echo "  TRIỂN KHAI HOÀN TẤT!"
echo "====================================================="
