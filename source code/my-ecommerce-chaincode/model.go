package main

import "time"

// Order định nghĩa cấu trúc dữ liệu lưu trên sổ cái (world state)
// Các thẻ `json:"..."` là BẮT BUỘC để CouchDB hiểu và cho phép rich query
type Order struct {
	DocType           string    `json:"docType"` // Dùng cho CouchDB query (Giá trị sẽ là "Order")
	OrderID           string    `json:"orderID"` // Khóa chính
	Status            string    `json:"status"`
	PaymentMethod     string    `json:"paymentMethod"`
	CodStatus         string    `json:"codStatus,omitempty"` // Bỏ qua nếu rỗng (cho đơn PREPAID)
	Amount            float64   `json:"amount"`
	SellerID          string    `json:"sellerID"`
	ShipperID         string    `json:"shipperID"`
	CustomerID        string    `json:"customerID"`
	CreatedAt         time.Time `json:"createdAt"`
	UpdatedAt         time.Time `json:"updatedAt"`
	DeliveryTimestamp time.Time `json:"deliveryTimestamp,omitempty"` // Bỏ qua nếu rỗng
	History           []HistoryEntry `json:"history"`
}

// HistoryEntry lưu lại lịch sử tóm tắt của các thay đổi
type HistoryEntry struct {
	TxID      string    `json:"txID"`
	Timestamp time.Time `json:"timestamp"`
	Action    string    `json:"action"` // Tên hàm chaincode được gọi
	ActorOrg  string    `json:"actorOrg"` // MSP ID của tổ chức gọi
}
