package main

import "time"

type Order struct {
    DocType           string    `json:"docType"`
    OrderID           string    `json:"orderID"` // Khóa chính
    Status            string    `json:"status"`  // Plaintext (Cho Logic)
    PaymentMethod     string    `json:"paymentMethod"` // Plaintext (Cho Logic)
    CodStatus         string    `json:"codStatus"`     // Plaintext (Cho Logic)
    SellerID          string    `json:"sellerID"`  // Plaintext (Cho Logic ACL)
    ShipperID         string    `json:"shipperID"` // Plaintext (Cho Logic ACL)
    CreatedAt         time.Time `json:"createdAt"`
    UpdatedAt         time.Time `json:"updatedAt"`
    DeliveryTimestamp time.Time `json:"deliveryTimestamp,omitempty"` // Plaintext (Cho Logic)
    SellerSensitiveData   string    `json:"seller_sensitive_data,omitempty"`
    ShipperSensitiveData  string    `json:"shipper_sensitive_data,omitempty"`
    History           []HistoryEntry `json:"history"`
}

type HistoryEntry struct {
    TxID      string    `json:"txID"`
    Timestamp time.Time `json:"timestamp"`
    Action    string    `json:"action"`
    ActorOrg  string    `json:"actorOrg"`
}