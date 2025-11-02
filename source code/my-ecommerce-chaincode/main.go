package main

import (
	"log"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

func main() {
	orderChaincode, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil {
		log.Panicf("Lỗi khi tạo chaincode: %v", err)
	}

	if err := orderChaincode.Start(); err != nil {
		log.Panicf("Lỗi khi khởi động chaincode: %v", err)
	}
}
