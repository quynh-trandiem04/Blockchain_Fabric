package main

import "time"

type Order struct {
	DocType           string    `json:"docType"`
	OrderID           string    `json:"orderID"` 
	Status            string    `json:"status"`
	PaymentMethod     string    `json:"paymentMethod"`
	CodStatus         string    `json:"codStatus"` 
	SellerID          string    `json:"sellerID"`
	ShipperID         string    `json:"shipperID"`
	CreatedAt         time.Time `json:"createdAt"`
	UpdatedAt         time.Time `json:"updatedAt"`
	DeliveryTimestamp time.Time `json:"deliveryTimestamp"`
	SellerSensitiveData   string    `json:"seller_sensitive_data,omitempty"`
	ShipperSensitiveData  string    `json:"shipper_sensitive_data,omitempty"`
	History           []HistoryEntry `json:"history"`
}

// HistoryEntry lưu lại lịch sử tóm tắt của các thay đổi
type HistoryEntry struct {
	TxID      string    `json:"txID"`
	Timestamp time.Time `json:"timestamp"`
	Action    string    `json:"action"` // Tên hàm chaincode được gọi
	ActorOrg  string    `json:"actorOrg"` // MSP ID của tổ chức gọi
}

