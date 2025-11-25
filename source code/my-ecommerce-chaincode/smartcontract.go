package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// SmartContract cung cấp các hàm logic cho chaincode
type SmartContract struct {
	contractapi.Contract
}


// ===================================================================================
// CÁC HÀM HELPER (Hỗ trợ)
// ===================================================================================

// getActorOrg trích xuất MSPID (Tên tổ chức) của người gọi hàm
func getActorOrg(ctx contractapi.TransactionContextInterface) (string, error) {
	mspID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return "", fmt.Errorf("không thể lấy MSPID của người gọi: %v", err)
	}
	return mspID, nil
}

// getOrderState lấy dữ liệu order từ sổ cái và chuyển thành struct *Order
func getOrderState(ctx contractapi.TransactionContextInterface, orderID string) (*Order, error) {
	orderJSON, err := ctx.GetStub().GetState(orderID)
	if err != nil {
		return nil, fmt.Errorf("lỗi khi đọc từ world state: %v", err)
	}
	if orderJSON == nil {
		return nil, fmt.Errorf("đơn hàng %s không tồn tại", orderID)
	}

	var order Order
	err = json.Unmarshal(orderJSON, &order)
	if err != nil {
		return nil, fmt.Errorf("lỗi unmarshal JSON: %v", err)
	}
	return &order, nil
}

// saveOrderState lưu lại trạng thái mới của Order vào sổ cái
func saveOrderState(ctx contractapi.TransactionContextInterface, order *Order) error {
	orderJSON, err := json.Marshal(order)
	if err != nil {
		return fmt.Errorf("lỗi marshal JSON: %v", err)
	}
	return ctx.GetStub().PutState(order.OrderID, orderJSON)
}

// orderExists kiểm tra xem orderID đã tồn tại hay chưa
func (s *SmartContract) orderExists(ctx contractapi.TransactionContextInterface, orderID string) (bool, error) {
	assetJSON, err := ctx.GetStub().GetState(orderID)
	if err != nil {
		return false, fmt.Errorf("lỗi khi đọc từ world state: %v", err)
	}
	return assetJSON != nil, nil
}

// getTimeNow lấy thời gian hiện tại từ transaction
func getTimeNow(ctx contractapi.TransactionContextInterface) (time.Time, error) {
	txTime, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return time.Time{}, fmt.Errorf("không thể lấy timestamp: %v", err)
	}
	return time.Unix(txTime.GetSeconds(), int64(txTime.GetNanos())), nil
}

// ===================================================================================
// CÁC HÀM GIAO DỊCH (Logic nghiệp vụ)
// ===================================================================================

// InitLedger (Tùy chọn): Thêm một số dữ liệu mẫu để test.
func (s *SmartContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	// Bạn có thể để trống hàm này hoặc thêm dữ liệu test
	return nil
}

// -----------------------------------------------------------------------------------
// [HÀM 1] 
// : Sàn TMĐT tạo một đơn hàng mới
// Chính sách (EP): OR('ECommercePlatformOrg.member')
// -----------------------------------------------------------------------------------
func (s *SmartContract) CreateOrder(ctx contractapi.TransactionContextInterface,
    orderID string, paymentMethod string, sellerID string, shipperID string, 
    sellerDataBlob string, shipperDataBlob string) error {

	// 1. Kiểm tra Access Control (ACL)
	actorOrg, err := getActorOrg(ctx)
	if err != nil {
		return err
	}
	// if actorOrg != "ECommercePlatformOrgMSP" {
	// 	return fmt.Errorf("lỗi: chỉ tổ chức 'ECommercePlatformOrgMSP' mới được phép tạo đơn hàng")
	// }

	// 2. Kiểm tra Pre-condition: Đơn hàng chưa tồn tại
	exists, err := s.orderExists(ctx, orderID)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("đơn hàng %s đã tồn tại", orderID)
	}

	// 3. Lấy thời gian
	txTime, err := getTimeNow(ctx)
	if err != nil {
		return err
	}

	// 4. Khởi tạo trạng thái ban đầu
	codStatus := ""
	if paymentMethod == "COD" {
		codStatus = "NOT_COLLECTED"
	}

	// 5. Tạo đối tượng Order
	order := Order{	
		DocType:       "Order",
		OrderID:       orderID,
		Status:        "CREATED",
		PaymentMethod: paymentMethod,
		CodStatus:     codStatus,
		SellerID:      sellerID,
		ShipperID:     shipperID,
		CreatedAt:     txTime,
		UpdatedAt:     txTime,
	        SellerSensitiveData:  sellerDataBlob,
        	ShipperSensitiveData: shipperDataBlob,
		History: []HistoryEntry{
			{
				TxID:      ctx.GetStub().GetTxID(),
				Timestamp: txTime,
				Action:    "CreateOrder",
				ActorOrg:  actorOrg,
			},
		},
	}

	// 6. Lưu vào sổ cái
	return saveOrderState(ctx, &order)
}

// -----------------------------------------------------------------------------------
// [HÀM 2] ConfirmPayment: Sàn xác nhận thanh toán (cho đơn Prepaid)
// Chính sách (EP): OR('ECommercePlatformOrg.member')
// -----------------------------------------------------------------------------------
func (s *SmartContract) ConfirmPayment(ctx contractapi.TransactionContextInterface, orderID string) error {
	// 1. Kiểm tra ACL
	actorOrg, err := getActorOrg(ctx)
	if err != nil {
		return err
	}
	if actorOrg != "ECommercePlatformOrgMSP" {
		return fmt.Errorf("lỗi: chỉ tổ chức 'ECommercePlatformOrgMSP' mới được xác nhận thanh toán")
	}

	// 2. Lấy đơn hàng
	order, err := getOrderState(ctx, orderID)
	if err != nil {
		return err
	}

	// 3. Kiểm tra Pre-condition (Logic)
	if order.PaymentMethod != "PREPAID" {
		return fmt.Errorf("lỗi: chỉ đơn hàng 'PREPAID' mới cần 'ConfirmPayment'")
	}
	if order.Status != "CREATED" {
		return fmt.Errorf("lỗi: chỉ đơn hàng 'CREATED' mới có thể 'ConfirmPayment'")
	}

	// 4. Lấy thời gian
	txTime, err := getTimeNow(ctx)
	if err != nil {
		return err
	}

	// 5. Cập nhật trạng thái
	order.Status = "PAID"
	order.UpdatedAt = txTime
	order.History = append(order.History, HistoryEntry{
		TxID:      ctx.GetStub().GetTxID(),
		Timestamp: txTime,
		Action:    "ConfirmPayment",
		ActorOrg:  actorOrg,
	})

	// 6. Lưu
	return saveOrderState(ctx, order)
}

// -----------------------------------------------------------------------------------
// [HÀM 3] CancelOrder: Sàn hủy đơn (trước khi giao)
// Chính sách (EP): OR('ECommercePlatformOrg.member')
// -----------------------------------------------------------------------------------
func (s *SmartContract) CancelOrder(ctx contractapi.TransactionContextInterface, orderID string) error {
	// 1. Kiểm tra ACL
	actorOrg, err := getActorOrg(ctx)
	if err != nil {
		return err
	}
	if actorOrg != "ECommercePlatformOrgMSP" {
		return fmt.Errorf("lỗi: chỉ tổ chức 'ECommercePlatformOrgMSP' mới được hủy đơn")
	}

	// 2. Lấy đơn hàng
	order, err := getOrderState(ctx, orderID)
	if err != nil {
		return err
	}

	// 3. Kiểm tra Pre-condition (Logic)
	if order.Status != "CREATED" && order.Status != "PAID" {
		return fmt.Errorf("lỗi: chỉ đơn hàng 'CREATED' hoặc 'PAID' mới có thể hủy. Trạng thái hiện tại: %s", order.Status)
	}

	// 4. Lấy thời gian
	txTime, err := getTimeNow(ctx)
	if err != nil {
		return err
	}

	// 5. Cập nhật trạng thái
	order.Status = "CANCELLED"
	order.UpdatedAt = txTime
	order.History = append(order.History, HistoryEntry{
		TxID:      ctx.GetStub().GetTxID(),
		Timestamp: txTime,
		Action:    "CancelOrder",
		ActorOrg:  actorOrg,
	})

	// 6. Lưu
	return saveOrderState(ctx, order)
}

// -----------------------------------------------------------------------------------
// [HÀM 4] ShipOrder: Nhà Bán & Vận chuyển bàn giao hàng
// Chính sách (EP): AND('SellerOrg.member', 'ShipperOrg.member')
// -----------------------------------------------------------------------------------
func (s *SmartContract) ShipOrder(ctx contractapi.TransactionContextInterface, orderID string) error {
	// 1. Kiểm tra ACL (Logic này kiểm tra NGƯỜI GỬI, EP `AND` sẽ được Fabric kiểm tra lúc commit)
	actorOrg, err := getActorOrg(ctx)
	if err != nil {
		return err
	}
	if actorOrg != "SellerOrgMSP" && actorOrg != "ShipperOrgMSP" {
		return fmt.Errorf("lỗi: chỉ 'SellerOrgMSP' hoặc 'ShipperOrgMSP' mới được gọi hàm này")
	}

	// 2. Lấy đơn hàng
	order, err := getOrderState(ctx, orderID)
	if err != nil {
		return err
	}

	// 3. Kiểm tra Pre-condition (Logic)
	if order.PaymentMethod == "PREPAID" && order.Status != "PAID" {
		return fmt.Errorf("lỗi: đơn 'PREPAID' phải ở trạng thái 'PAID' mới được giao. Trạng thái hiện tại: %s", order.Status)
	}
	if order.PaymentMethod == "COD" && order.Status != "CREATED" {
		return fmt.Errorf("lỗi: đơn 'COD' phải ở trạng thái 'CREATED' mới được giao. Trạng thái hiện tại: %s", order.Status)
	}

	// 4. Lấy thời gian
	txTime, err := getTimeNow(ctx)
	if err != nil {
		return err
	}

	// 5. Cập nhật trạng thái
	order.Status = "SHIPPED"
	order.UpdatedAt = txTime
	order.History = append(order.History, HistoryEntry{
		TxID:      ctx.GetStub().GetTxID(),
		Timestamp: txTime,
		Action:    "ShipOrder",
		ActorOrg:  actorOrg,
	})

	// 6. Lưu
	return saveOrderState(ctx, order)
}

// -----------------------------------------------------------------------------------
// [HÀM 5] ConfirmDelivery: Vận chuyển giao (Đơn trả trước)
// Chính sách (EP): OR('ShipperOrg.member')
// -----------------------------------------------------------------------------------
func (s *SmartContract) ConfirmDelivery(ctx contractapi.TransactionContextInterface, orderID string) error {
	// 1. Kiểm tra ACL
	actorOrg, err := getActorOrg(ctx)
	if err != nil {
		return err
	}
	if actorOrg != "ShipperOrgMSP" {
		return fmt.Errorf("lỗi: chỉ tổ chức 'ShipperOrgMSP' mới được xác nhận giao hàng")
	}

	// 2. Lấy đơn hàng
	order, err := getOrderState(ctx, orderID)
	if err != nil {
		return err
	}

	// 3. Kiểm tra Pre-condition (Logic)
	if order.PaymentMethod != "PREPAID" {
		return fmt.Errorf("lỗi: hàm 'ConfirmDelivery' chỉ dùng cho đơn 'PREPAID'")
	}
	if order.Status != "SHIPPED" {
		return fmt.Errorf("lỗi: đơn hàng phải ở trạng thái 'SHIPPED' mới được giao. Trạng thái hiện tại: %s", order.Status)
	}

	// 4. Lấy thời gian
	txTime, err := getTimeNow(ctx)
	if err != nil {
		return err
	}

	// 5. Cập nhật trạng thái
	order.Status = "DELIVERED"
	order.DeliveryTimestamp = txTime // <-- Ghi lại mốc thời gian giao hàng
	order.UpdatedAt = txTime
	order.History = append(order.History, HistoryEntry{
		TxID:      ctx.GetStub().GetTxID(),
		Timestamp: txTime,
		Action:    "ConfirmDelivery",
		ActorOrg:  actorOrg,
	})

	// 6. Lưu
	return saveOrderState(ctx, order)
}

// -----------------------------------------------------------------------------------
// [HÀM 6] ConfirmCODDelivery: Vận chuyển giao & thu tiền (Đơn COD)
// Chính sách (EP): OR('ShipperOrg.member')
// -----------------------------------------------------------------------------------
func (s *SmartContract) ConfirmCODDelivery(ctx contractapi.TransactionContextInterface, orderID string) error {
	// 1. Kiểm tra ACL
	actorOrg, err := getActorOrg(ctx)
	if err != nil {
		return err
	}
	if actorOrg != "ShipperOrgMSP" {
		return fmt.Errorf("lỗi: chỉ tổ chức 'ShipperOrgMSP' mới được xác nhận giao hàng COD")
	}

	// 2. Lấy đơn hàng
	order, err := getOrderState(ctx, orderID)
	if err != nil {
		return err
	}

	// 3. Kiểm tra Pre-condition (Logic)
	if order.PaymentMethod != "COD" {
		return fmt.Errorf("lỗi: hàm 'ConfirmCODDelivery' chỉ dùng cho đơn 'COD'")
	}
	if order.Status != "SHIPPED" {
		return fmt.Errorf("lỗi: đơn hàng phải ở trạng thái 'SHIPPED' mới được giao. Trạng thái hiện tại: %s", order.Status)
	}

	// 4. Lấy thời gian
	txTime, err := getTimeNow(ctx)
	if err != nil {
		return err
	}

	// 5. Cập nhật trạng thái
	order.Status = "DELIVERED"
	order.CodStatus = "PENDING_REMITTANCE" // <-- Cập nhật trạng thái COD
	order.DeliveryTimestamp = txTime       // <-- Ghi lại mốc thời gian giao hàng
	order.UpdatedAt = txTime
	order.History = append(order.History, HistoryEntry{
		TxID:      ctx.GetStub().GetTxID(),
		Timestamp: txTime,
		Action:    "ConfirmCODDelivery",
		ActorOrg:  actorOrg,
	})

	// 6. Lưu
	return saveOrderState(ctx, order)
}

// -----------------------------------------------------------------------------------
// [HÀM 7] RemitCOD: Vận chuyển nộp tiền COD cho Sàn
// Chính sách (EP): AND('ECommercePlatformOrg.member', 'ShipperOrg.member')
// -----------------------------------------------------------------------------------
func (s *SmartContract) RemitCOD(ctx contractapi.TransactionContextInterface, orderID string) error {
	// 1. Kiểm tra ACL
	actorOrg, err := getActorOrg(ctx)
	if err != nil {
		return err
	}
	if actorOrg != "ECommercePlatformOrgMSP" && actorOrg != "ShipperOrgMSP" {
		return fmt.Errorf("lỗi: chỉ 'ECommercePlatformOrgMSP' hoặc 'ShipperOrgMSP' mới được gọi hàm này")
	}

	// 2. Lấy đơn hàng
	order, err := getOrderState(ctx, orderID)
	if err != nil {
		return err
	}

	// 3. Kiểm tra Pre-condition (Logic)
	if order.CodStatus != "PENDING_REMITTANCE" {
		return fmt.Errorf("lỗi: trạng thái COD phải là 'PENDING_REMITTANCE'. Trạng thái hiện tại: %s", order.CodStatus)
	}

	// 4. Lấy thời gian
	txTime, err := getTimeNow(ctx)
	if err != nil {
		return err
	}

	// 5. Cập nhật trạng thái
	order.CodStatus = "REMITTED"
	order.UpdatedAt = txTime
	order.History = append(order.History, HistoryEntry{
		TxID:      ctx.GetStub().GetTxID(),
		Timestamp: txTime,
		Action:    "RemitCOD",
		ActorOrg:  actorOrg,
	})

	// 6. Lưu
	return saveOrderState(ctx, order)
}

// -----------------------------------------------------------------------------------
// [HÀM 8] PayoutToSeller: Sàn thanh toán cho Nhà Bán (sau 7 ngày)
// Chính sách (EP): AND('ECommercePlatformOrg.member', 'SellerOrg.member')
// -----------------------------------------------------------------------------------
func (s *SmartContract) PayoutToSeller(ctx contractapi.TransactionContextInterface, orderID string) error {
	// 1. Kiểm tra ACL
	actorOrg, err := getActorOrg(ctx)
	if err != nil {
		return err
	}
	if actorOrg != "ECommercePlatformOrgMSP" && actorOrg != "SellerOrgMSP" {
		return fmt.Errorf("lỗi: chỉ 'ECommercePlatformOrgMSP' hoặc 'SellerOrgMSP' mới được gọi hàm này")
	}

	// 2. Lấy đơn hàng
	order, err := getOrderState(ctx, orderID)
	if err != nil {
		return err
	}

	// 3. Lấy thời gian hiện tại
	txTime, err := getTimeNow(ctx)
	if err != nil {
		return err
	}

	// 4. Kiểm tra Pre-condition (Logic nghiệp vụ - Trạng thái)
	if order.PaymentMethod == "PREPAID" && order.Status != "DELIVERED" {
		return fmt.Errorf("chỉ có thể thanh toán cho đơn PREPAID đã 'DELIVERED'")
	}
	if order.PaymentMethod == "COD" && (order.Status != "DELIVERED" || order.CodStatus != "REMITTED") {
		return fmt.Errorf("chỉ có thể thanh toán cho đơn COD đã 'DELIVERED' và 'REMITTED'")
	}
	if order.Status == "SETTLED" {
		return fmt.Errorf("đơn hàng đã được thanh toán (SETTLED) từ trước")
	}

	// 5. KIỂM TRA LOGIC THỜI GIAN 7 NGÀY (Rất quan trọng)
	if order.DeliveryTimestamp.IsZero() {
		return fmt.Errorf("lỗi: không tìm thấy mốc thời gian giao hàng (deliveryTimestamp)")
	}

	// Tính 7 ngày sau khi giao hàng (7 * 24 giờ)
	payoutUnlockTime := order.DeliveryTimestamp.Add(time.Hour * 24 * 7)

	if txTime.Before(payoutUnlockTime) {
		return fmt.Errorf("chưa đủ 7 ngày kể từ khi giao hàng. Không thể thanh toán. Mở khóa lúc: %v", payoutUnlockTime)
	}

	// 6. Cập nhật trạng thái
	order.Status = "SETTLED"
	order.UpdatedAt = txTime
	order.History = append(order.History, HistoryEntry{
		TxID:      ctx.GetStub().GetTxID(),
		Timestamp: txTime,
		Action:    "PayoutToSeller",
		ActorOrg:  actorOrg,
	})

	// 7. Lưu lại sổ cái
	return saveOrderState(ctx, order)
}

// -----------------------------------------------------------------------------------
// [HÀM 9] RequestReturn: Sàn yêu cầu trả hàng (trong 7 ngày)
// Chính sách (EP): OR('ECommercePlatformOrg.member')
// -----------------------------------------------------------------------------------
func (s *SmartContract) RequestReturn(ctx contractapi.TransactionContextInterface, orderID string) error {
	// 1. Kiểm tra ACL
	actorOrg, err := getActorOrg(ctx)
	if err != nil {
		return err
	}
	if actorOrg != "ECommercePlatformOrgMSP" {
		return fmt.Errorf("lỗi: chỉ tổ chức 'ECommercePlatformOrgMSP' mới được yêu cầu trả hàng")
	}

	// 2. Lấy đơn hàng
	order, err := getOrderState(ctx, orderID)
	if err != nil {
		return err
	}

	// 3. Lấy thời gian hiện tại
	txTime, err := getTimeNow(ctx)
	if err != nil {
		return err
	}

	// 4. Kiểm tra Pre-condition (Logic nghiệp vụ - Trạng thái)
	if order.Status != "DELIVERED" {
		return fmt.Errorf("lỗi: chỉ có thể trả hàng khi đơn ở trạng thái 'DELIVERED'. Trạng thái hiện tại: %s", order.Status)
	}

	// 5. KIỂM TRA LOGIC THỜI GIAN 7 NGÀY (Rất quan trọng)
	if order.DeliveryTimestamp.IsZero() {
		return fmt.Errorf("lỗi: không tìm thấy mốc thời gian giao hàng (deliveryTimestamp)")
	}

	// Tính 7 ngày sau khi giao hàng (7 * 24 giờ)
	returnDeadline := order.DeliveryTimestamp.Add(time.Hour * 24 * 7)

	if txTime.After(returnDeadline) {
		return fmt.Errorf("đã quá 7 ngày kể từ khi giao hàng. Không thể trả hàng. Hạn chót: %v", returnDeadline)
	}

	// 6. Cập nhật trạng thái
	order.Status = "RETURN_REQUESTED"
	order.UpdatedAt = txTime
	order.History = append(order.History, HistoryEntry{
		TxID:      ctx.GetStub().GetTxID(),
		Timestamp: txTime,
		Action:    "RequestReturn",
		ActorOrg:  actorOrg,
	})

	// 7. Lưu lại sổ cái
	return saveOrderState(ctx, order)
}

// -----------------------------------------------------------------------------------
// [HÀM 10] ShipReturn: Vận chuyển lấy hàng trả từ khách
// Chính sách (EP): AND('ShipperOrg.member', 'ECommercePlatformOrg.member')
// -----------------------------------------------------------------------------------
func (s *SmartContract) ShipReturn(ctx contractapi.TransactionContextInterface, orderID string) error {
	// 1. Kiểm tra ACL
	actorOrg, err := getActorOrg(ctx)
	if err != nil {
		return err
	}
	if actorOrg != "ShipperOrgMSP" && actorOrg != "ECommercePlatformOrgMSP" {
		return fmt.Errorf("lỗi: chỉ 'ShipperOrgMSP' hoặc 'ECommercePlatformOrgMSP' mới được gọi hàm này")
	}

	// 2. Lấy đơn hàng
	order, err := getOrderState(ctx, orderID)
	if err != nil {
		return err
	}

	// 3. Kiểm tra Pre-condition (Logic)
	if order.Status != "RETURN_REQUESTED" {
		return fmt.Errorf("lỗi: chỉ đơn hàng 'RETURN_REQUESTED' mới có thể 'ShipReturn'. Trạng thái hiện tại: %s", order.Status)
	}

	// 4. Lấy thời gian
	txTime, err := getTimeNow(ctx)
	if err != nil {
		return err
	}

	// 5. Cập nhật trạng thái
	order.Status = "RETURN_IN_TRANSIT"
	order.UpdatedAt = txTime
	order.History = append(order.History, HistoryEntry{
		TxID:      ctx.GetStub().GetTxID(),
		Timestamp: txTime,
		Action:    "ShipReturn",
		ActorOrg:  actorOrg,
	})

	// 6. Lưu
	return saveOrderState(ctx, order)
}

// -----------------------------------------------------------------------------------
// [HÀM 11] ConfirmReturnReceived: Nhà Bán nhận lại hàng trả
// Chính sách (EP): AND('SellerOrg.member', 'ECommercePlatformOrg.member')
// -----------------------------------------------------------------------------------
func (s *SmartContract) ConfirmReturnReceived(ctx contractapi.TransactionContextInterface, orderID string) error {
	// 1. Kiểm tra ACL
	actorOrg, err := getActorOrg(ctx)
	if err != nil {
		return err
	}
	if actorOrg != "SellerOrgMSP" && actorOrg != "ECommercePlatformOrgMSP" {
		return fmt.Errorf("lỗi: chỉ 'SellerOrgMSP' hoặc 'ECommercePlatformOrgMSP' mới được gọi hàm này")
	}

	// 2. Lấy đơn hàng
	order, err := getOrderState(ctx, orderID)
	if err != nil {
		return err
	}

	// 3. Kiểm tra Pre-condition (Logic)
	if order.Status != "RETURN_IN_TRANSIT" {
		return fmt.Errorf("lỗi: chỉ đơn hàng 'RETURN_IN_TRANSIT' mới có thể 'ConfirmReturnReceived'. Trạng thái hiện tại: %s", order.Status)
	}

	// 4. Lấy thời gian
	txTime, err := getTimeNow(ctx)
	if err != nil {
		return err
	}

	// 5. Cập nhật trạng thái
	order.Status = "RETURNED"
	order.UpdatedAt = txTime
	order.History = append(order.History, HistoryEntry{
		TxID:      ctx.GetStub().GetTxID(),
		Timestamp: txTime,
		Action:    "ConfirmReturnReceived",
		ActorOrg:  actorOrg,
	})

	// 6. Lưu
	return saveOrderState(ctx, order)
}

// ===================================================================================
// CÁC HÀM TRUY VẤN (Chỉ đọc)
// ===================================================================================

// -----------------------------------------------------------------------------------
// [HÀM 12] QueryOrder: Hàm chỉ đọc, truy vấn thông tin một đơn hàng
// Chính sách (EP): Bất kỳ ai trong 3 tổ chức
// -----------------------------------------------------------------------------------
func (s *SmartContract) QueryOrder(ctx contractapi.TransactionContextInterface, orderID string) (*Order, error) {
	// 1. Kiểm tra ACL (Đảm bảo người gọi thuộc 1 trong 3 tổ chức)
	actorOrg, err := getActorOrg(ctx)
	if err != nil {
		return nil, err
	}
	if actorOrg != "ECommercePlatformOrgMSP" && actorOrg != "SellerOrgMSP" && actorOrg != "ShipperOrgMSP" {
		return nil, fmt.Errorf("lỗi: tổ chức của bạn (%s) không được phép truy vấn dữ liệu", actorOrg)
	}

	// 2. Lấy đơn hàng
	order, err := getOrderState(ctx, orderID)
	if err != nil {
		return nil, err
	}
	
	// (Lưu ý: Logic về Private Data Collections (PDC) sẽ được thêm vào đây nếu cần)
	
	return order, nil
}

// (Bạn có thể thêm các hàm Rich Query (truy vấn phức tạp) cho CouchDB ở đây)
// Ví dụ: func (s *SmartContract) QueryOrdersBySeller(ctx contractapi.TransactionContextInterface, sellerID string) ([]*Order, error) { ... }

