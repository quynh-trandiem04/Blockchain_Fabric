#!/bin/bash

# Dừng nếu có lỗi
set -e

echo "🚀 BẮT ĐẦU QUY TRÌNH RESET MẠNG BLOCKCHAIN..."

# 1. Tắt mạng và Xóa sạch Container + Volume
echo "🛑 Tắt container và xóa Volume..."
docker-compose -f compose/compose-test-net.yaml -f compose/compose-couch.yaml down --volumes --remove-orphans
docker volume prune -f
docker network prune -f

# 2. Xóa các file chứng chỉ và artifacts cũ
echo "🗑️ Xóa file cũ..."
sudo rm -rf organizations/peerOrganizations
sudo rm -rf organizations/ordererOrganizations
sudo rm -rf channel-artifacts/*
sudo rm -rf system-genesis-block/*

# 3. Tạo lại Chứng chỉ (Crypto Material)
echo "🔐 Tạo chứng chỉ mới..."
export PATH=$PATH:${PWD}/../bin
export FABRIC_CFG_PATH=${PWD}/configtx

cryptogen generate --config=./organizations/cryptogen/crypto-config-orderer.yaml --output="organizations"
cryptogen generate --config=./organizations/cryptogen/crypto-config-org1.yaml --output="organizations"
cryptogen generate --config=./organizations/cryptogen/crypto-config-org2.yaml --output="organizations"
cryptogen generate --config=./organizations/cryptogen/crypto-config-shipper.yaml --output="organizations"

# 4. Tạo Genesis Block và Channel Transaction
echo "📦 Tạo Genesis Block & Channel Tx..."
# Genesis Block
configtxgen -profile ThreeOrgsOrdererGenesis -channelID system-channel -outputBlock ./channel-artifacts/genesis.block

# Channel Tx
configtxgen -profile ThreeOrgsChannel -outputCreateChannelTx ./channel-artifacts/orderchannel.tx -channelID orderchannel

# Anchor Peers
configtxgen -profile ThreeOrgsChannel -outputAnchorPeersUpdate ./channel-artifacts/ECommercePlatformOrgMSPAnchors.tx -channelID orderchannel -asOrg ECommercePlatformOrgMSP
configtxgen -profile ThreeOrgsChannel -outputAnchorPeersUpdate ./channel-artifacts/SellerOrgMSPAnchors.tx -channelID orderchannel -asOrg SellerOrgMSP
configtxgen -profile ThreeOrgsChannel -outputAnchorPeersUpdate ./channel-artifacts/ShipperOrgMSPAnchors.tx -channelID orderchannel -asOrg ShipperOrgMSP

# 5. Khởi động lại Mạng
echo "🐳 Khởi động Docker Containers..."
docker-compose -f compose/compose-test-net.yaml -f compose/compose-couch.yaml up -d

echo "⏳ Đợi 10 giây cho các node khởi động..."
sleep 10

# 6. Thiết lập Biến môi trường chung
export FABRIC_CFG_PATH=$PWD/../config
export ORDERER_CA=${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer0.example.com/msp/tlscacerts/tlsca.example.com-cert.pem

# 7. TẠO KÊNH (Create Channel)
echo "REQUEST: Tạo kênh 'orderchannel'..."
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="ECommercePlatformOrgMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/ecommerce.com/peers/peer0.ecommerce.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/ecommerce.com/users/Admin@ecommerce.com/msp
export CORE_PEER_ADDRESS=peer0.ecommerce.com:7051
export CORE_PEER_TLS_SERVERHOSTOVERRIDE=peer0.ecommerce.com

peer channel create -o orderer0.example.com:7050 -c orderchannel -f ./channel-artifacts/orderchannel.tx --outputBlock ./channel-artifacts/orderchannel.block --tls --cafile $ORDERER_CA

# 8. JOIN KÊNH (Join Channel)
echo "🤝 Join kênh cho Peer Ecommerce..."
peer channel join -b ./channel-artifacts/orderchannel.block

echo "🤝 Join kênh cho Peer Seller..."
export CORE_PEER_LOCALMSPID="SellerOrgMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/seller.com/peers/peer0.seller.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/seller.com/users/Admin@seller.com/msp
export CORE_PEER_ADDRESS=peer0.seller.com:9051
export CORE_PEER_TLS_SERVERHOSTOVERRIDE=peer0.seller.com

peer channel join -b ./channel-artifacts/orderchannel.block

echo "🤝 Join kênh cho Peer Shipper..."
export CORE_PEER_LOCALMSPID="ShipperOrgMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/shipper.com/peers/peer0.shipper.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/shipper.com/users/Admin@shipper.com/msp
export CORE_PEER_ADDRESS=peer0.shipper.com:11051
export CORE_PEER_TLS_SERVERHOSTOVERRIDE=peer0.shipper.com

peer channel join -b ./channel-artifacts/orderchannel.block

# 9. UPDATE ANCHOR PEERS
echo "⚓ Cập nhật Anchor Peers..."

# Ecommerce
export CORE_PEER_LOCALMSPID="ECommercePlatformOrgMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/ecommerce.com/peers/peer0.ecommerce.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/ecommerce.com/users/Admin@ecommerce.com/msp
export CORE_PEER_ADDRESS=peer0.ecommerce.com:7051
export CORE_PEER_TLS_SERVERHOSTOVERRIDE=peer0.ecommerce.com
peer channel update -o orderer0.example.com:7050 -c orderchannel -f ./channel-artifacts/ECommercePlatformOrgMSPAnchors.tx --tls --cafile $ORDERER_CA

# Seller
export CORE_PEER_LOCALMSPID="SellerOrgMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/seller.com/peers/peer0.seller.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/seller.com/users/Admin@seller.com/msp
export CORE_PEER_ADDRESS=peer0.seller.com:9051
export CORE_PEER_TLS_SERVERHOSTOVERRIDE=peer0.seller.com
peer channel update -o orderer0.example.com:7050 -c orderchannel -f ./channel-artifacts/SellerOrgMSPAnchors.tx --tls --cafile $ORDERER_CA

# Shipper
export CORE_PEER_LOCALMSPID="ShipperOrgMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/shipper.com/peers/peer0.shipper.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/shipper.com/users/Admin@shipper.com/msp
export CORE_PEER_ADDRESS=peer0.shipper.com:11051
export CORE_PEER_TLS_SERVERHOSTOVERRIDE=peer0.shipper.com
peer channel update -o orderer0.example.com:7050 -c orderchannel -f ./channel-artifacts/ShipperOrgMSPAnchors.tx --tls --cafile $ORDERER_CA

echo "✅ HOÀN TẤT SETUP MẠNG TRÊN UBUNTU!"
echo "👉 BƯỚC TIẾP THEO: Copy thư mục 'organizations' về Windows và chạy Deploy Chaincode."
