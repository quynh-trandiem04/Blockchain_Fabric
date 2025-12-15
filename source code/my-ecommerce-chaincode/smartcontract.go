package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
	"github.com/hyperledger/fabric-chaincode-go/shim"
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
		return "", fmt.Errorf("không thể lấy MSPID: %v", err)
	}
	return mspID, nil
}

// getCallerCompanyID: Lấy attribute 'companyCode' từ chứng chỉ user
func getCallerCompanyID(ctx contractapi.TransactionContextInterface) (string, error) {
	val, found, err := ctx.GetClientIdentity().GetAttributeValue("companyCode")
	if err != nil {
		return "", fmt.Errorf("lỗi đọc attribute: %v", err)
	}
	if !found {
		return "", nil 
	}
	return val, nil
}

// getOrderState: Lấy dữ liệu order từ sổ cái
func getOrderState(ctx contractapi.TransactionContextInterface, orderID string) (*Order, error) {
	orderJSON, err := ctx.GetStub().GetState(orderID)
	if err != nil {
		return nil, fmt.Errorf("lỗi đọc world state: %v", err)
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

// saveOrderState: Lưu order vào sổ cái
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
		return false, fmt.Errorf("lỗi đọc world state: %v", err)
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
// CÁC HÀM GIAO DỊCH (BUSINESS LOGIC)
// ===================================================================================

// InitLedger (Tùy chọn): Thêm một số dữ liệu mẫu để test.
func (s *SmartContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	// Bạn có thể để trống hàm này hoặc thêm dữ liệu test
	return nil
}

// -----------------------------------------------------------------------------------
// [HÀM 1] CreateOrder: Tạo đơn hàng
// -----------------------------------------------------------------------------------
func (s *SmartContract) CreateOrder(ctx contractapi.TransactionContextInterface,
	orderID string, 
	paymentMethod string, 
	shipperCompanyID string,
	sellerDataBlob string, 
	shipperDataBlob string,
    sellerCompanyID string) error {

	// 1. Kiểm tra đầu vào
	if shipperCompanyID == "" {
		return fmt.Errorf("lỗi: đơn hàng phải có ShipperCompanyID (Đơn vị vận chuyển)")
	}

	// 2. Lấy định danh người gọi
	actorOrg, err := getActorOrg(ctx)
	if err != nil { return err }

	//callerCompanyID, _ := getCallerCompanyID(ctx)

	// Chỉ Seller hoặc Sàn được tạo đơn
	if actorOrg != "SellerOrgMSP"{
		return fmt.Errorf("lỗi: tổ chức '%s' không có quyền tạo đơn", actorOrg)
	}

	// 3. Kiểm tra trùng lặp
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
		
		// Gán thông tin chủ sở hữu
		SellerID:        actorOrg,        
		SellerCompanyID: sellerCompanyID, 
		
		// Gán thông tin vận chuyển
		ShipperID:        "ShipperOrgMSP", 
		ShipperCompanyID: shipperCompanyID,

		CreatedAt:            txTime,
		UpdatedAt:            txTime,
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
// [HÀM 2] ConfirmPayment: Sàn xác nhận thanh toán
// -----------------------------------------------------------------------------------
func (s *SmartContract) ConfirmPayment(ctx contractapi.TransactionContextInterface, orderID string) error {
	// 1. Kiểm tra ACL
	actorOrg, err := getActorOrg(ctx)
	if err != nil {
		return err
	}
	if actorOrg != "ECommercePlatformOrgMSP" {
		return fmt.Errorf("chỉ Sàn TMĐT mới được xác nhận thanh toán")
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
// [HÀM 4] ShipOrder: Đơn vị vận chuyển xác nhận lấy hàng
// Chính sách: Chỉ ShipperOrg mới được gọi, và phải đúng CompanyID
// -----------------------------------------------------------------------------------
func (s *SmartContract) ShipOrder(ctx contractapi.TransactionContextInterface, orderID string) error {
	order, err := getOrderState(ctx, orderID)
	if err != nil { return err }

	actorOrg, _ := getActorOrg(ctx)
	
	// 1. KIỂM TRA QUYỀN (CHỈ CHO 1 ORG LÀ SHIPPER GỌI)
	if actorOrg != "ShipperOrgMSP" {
		return fmt.Errorf("lỗi: chỉ tổ chức vận chuyển 'ShipperOrgMSP' mới được phép xác nhận lấy hàng")
	}

	// 2. KIỂM TRA ĐÚNG ĐƠN VỊ VẬN CHUYỂN (Multi-tenancy)
	callerCompany, err := getCallerCompanyID(ctx)
	if err != nil {
		return fmt.Errorf("lỗi xác thực danh tính công ty: %v", err)
	}

	if order.ShipperCompanyID != callerCompany {
		return fmt.Errorf("LỖI QUYỀN: Đơn hàng thuộc về '%s', bạn thuộc đơn vị '%s'", order.ShipperCompanyID, callerCompany)
	}

	// 3. KIỂM TRA ĐIỀU KIỆN LOGIC (QUAN TRỌNG: GIỮ NGUYÊN)
	if order.PaymentMethod == "PREPAID" && order.Status != "PAID" {
		return fmt.Errorf("lỗi: đơn PREPAID phải thanh toán (PAID) mới được giao. Trạng thái hiện tại: %s", order.Status)
	}
	if order.PaymentMethod == "COD" && order.Status != "CREATED" {
		return fmt.Errorf("lỗi: đơn COD phải ở trạng thái CREATED mới được giao. Trạng thái hiện tại: %s", order.Status)
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
// [HÀM 5] ConfirmDelivery: Shipper xác nhận giao thành công (Prepaid)
// -----------------------------------------------------------------------------------
func (s *SmartContract) ConfirmDelivery(ctx contractapi.TransactionContextInterface, orderID string) error {
	order, err := getOrderState(ctx, orderID)
	if err != nil { return err }

	actorOrg, _ := getActorOrg(ctx)
	callerCompany, _ := getCallerCompanyID(ctx)

	// Check quyền
	if actorOrg != "ShipperOrgMSP" {
		return fmt.Errorf("chỉ ShipperOrg mới được xác nhận giao hàng")
	}
	if order.ShipperCompanyID != callerCompany {
		return fmt.Errorf("sai đơn vị vận chuyển: đơn là '%s', bạn là '%s'", order.ShipperCompanyID, callerCompany)
	}

	// Check Logic
	if order.PaymentMethod != "PREPAID" {
		return fmt.Errorf("hàm này chỉ cho đơn PREPAID")
	}
	if order.Status != "SHIPPED" {
		return fmt.Errorf("đơn phải đang SHIPPED")
	}

	// 4. Lấy thời gian
	txTime, err := getTimeNow(ctx)
	if err != nil {
		return err
	}

	// 5. Cập nhật trạng thái
	order.Status = "DELIVERED"
	order.DeliveryTimestamp = txTime
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
// [HÀM 6] ConfirmCODDelivery: Shipper giao & thu tiền (COD)
// -----------------------------------------------------------------------------------
func (s *SmartContract) ConfirmCODDelivery(ctx contractapi.TransactionContextInterface, orderID string) error {
	order, err := getOrderState(ctx, orderID)
	if err != nil { return err }

	actorOrg, _ := getActorOrg(ctx)
	callerCompany, _ := getCallerCompanyID(ctx)

	// Check quyền
	if actorOrg != "ShipperOrgMSP" {
		return fmt.Errorf("chỉ ShipperOrg mới được gọi")
	}
	if order.ShipperCompanyID != callerCompany {
		return fmt.Errorf("sai đơn vị vận chuyển")
	}

	// Check Logic
	if order.PaymentMethod != "COD" {
		return fmt.Errorf("hàm này chỉ cho đơn COD")
	}
	if order.Status != "SHIPPED" {
		return fmt.Errorf("đơn phải đang SHIPPED")
	}

	// 4. Lấy thời gian
	txTime, err := getTimeNow(ctx)
	if err != nil {
		return err
	}

	// 5. Cập nhật trạng thái
	order.Status = "DELIVERED"
	order.CodStatus = "PENDING_REMITTANCE"
	order.DeliveryTimestamp = txTime
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
// [HÀM 7] RemitCOD: Sàn xác nhận đã nhận tiền COD từ Shipper
// -----------------------------------------------------------------------------------
func (s *SmartContract) RemitCOD(ctx contractapi.TransactionContextInterface, orderID string) error {
	// 1. Kiểm tra ACL
	actorOrg, err := getActorOrg(ctx)
	if err != nil {
		return err
	}
	if actorOrg != "ECommercePlatformOrgMSP" {
		return fmt.Errorf("chỉ Sàn TMĐT mới xác nhận đã nhận tiền COD (Remit)")
	}

	// 2. Lấy đơn hàng
	order, err := getOrderState(ctx, orderID)
	if err != nil {
		return err
	}

	// 3. Kiểm tra Pre-condition (Logic)
	if order.CodStatus != "PENDING_REMITTANCE" {
		return fmt.Errorf("CodStatus phải là PENDING_REMITTANCE")
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
// [HÀM 8] PayoutToSeller: Thanh toán cho Seller
// Logic: Giữ nguyên kiểm tra PREPAID/COD và 5 phút
// -----------------------------------------------------------------------------------
func (s *SmartContract) PayoutToSeller(ctx contractapi.TransactionContextInterface, orderID string) error {
	// 1. Kiểm tra ACL
	actorOrg, err := getActorOrg(ctx)
	if err != nil {
		return err
	}
	if actorOrg != "ECommercePlatformOrgMSP" {
		return fmt.Errorf("lỗi: chỉ 'ECommercePlatformOrgMSP'mới được gọi hàm này")
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

	// 4. Kiểm tra Pre-condition (Logic nghiệp vụ - Trạng thái) - GIỮ NGUYÊN
	if order.PaymentMethod == "PREPAID" && order.Status != "DELIVERED" {
		return fmt.Errorf("chỉ có thể thanh toán cho đơn PREPAID đã 'DELIVERED'")
	}
	if order.PaymentMethod == "COD" && (order.Status != "DELIVERED" || order.CodStatus != "REMITTED") {
		return fmt.Errorf("chỉ có thể thanh toán cho đơn COD đã 'DELIVERED' và 'REMITTED'")
	}
	if order.Status == "SETTLED" {
		return fmt.Errorf("đơn hàng đã được thanh toán (SETTLED) từ trước")
	}

    // 5. KIỂM TRA LOGIC THỜI GIAN (DEMO: 5 PHÚT)
	if order.DeliveryTimestamp.IsZero() {
		return fmt.Errorf("lỗi: không tìm thấy mốc thời gian giao hàng (deliveryTimestamp)")
	}

    // Thay vì 7 ngày (time.Hour * 24 * 7), ta dùng 5 phút (time.Minute * 5)
    // Nhưng thông báo lỗi vẫn giữ nguyên là "7 ngày"
    payoutUnlockTime := order.DeliveryTimestamp.Add(time.Minute * 5) 

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
// [HÀM 9] RequestReturn: Sàn yêu cầu trả hàng (trong 7 ngày -> DEMO: 5 phút)
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

    // 5. KIỂM TRA LOGIC THỜI GIAN (DEMO: 5 PHÚT)
	if order.DeliveryTimestamp.IsZero() {
		return fmt.Errorf("lỗi: không tìm thấy mốc thời gian giao hàng (deliveryTimestamp)")
	}

    // Thời hạn trả hàng cũng giảm xuống 5 phút để test case "hết hạn trả hàng"
    returnDeadline := order.DeliveryTimestamp.Add(time.Minute * 5)

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
// Chính sách (EP): OR('ShipperOrgMSP.member')
// -----------------------------------------------------------------------------------
func (s *SmartContract) ShipReturn(ctx contractapi.TransactionContextInterface, orderID string) error {
	order, err := getOrderState(ctx, orderID)
	if err != nil { return err }

	actorOrg, _ := getActorOrg(ctx)
	callerCompany, _ := getCallerCompanyID(ctx)

	if actorOrg != "ShipperOrgMSP" {
		return fmt.Errorf("chỉ Shipper mới được lấy hàng trả")
	}
	if order.ShipperCompanyID != callerCompany {
		return fmt.Errorf("sai đơn vị vận chuyển: đơn của '%s', bạn là '%s'", order.ShipperCompanyID, callerCompany)
	}

	if order.Status != "RETURN_REQUESTED" {
		return fmt.Errorf("trạng thái phải là RETURN_REQUESTED")
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
// [HÀM 11] ConfirmReturnReceived: Seller nhận lại hàng trả
// -----------------------------------------------------------------------------------
func (s *SmartContract) ConfirmReturnReceived(ctx contractapi.TransactionContextInterface, orderID string) error {
	order, err := getOrderState(ctx, orderID)
	if err != nil { return err }

	actorOrg, _ := getActorOrg(ctx)
	callerCompany, _ := getCallerCompanyID(ctx)

	// Check quyền Seller
	if actorOrg != "SellerOrgMSP" {
		return fmt.Errorf("chỉ Seller mới được xác nhận nhận hàng")
	}
	if order.SellerID != actorOrg {
		return fmt.Errorf("không phải đơn của tổ chức bạn")
	}
	// Check đúng Shop (Multi-vendor)
	if order.SellerCompanyID != "" && order.SellerCompanyID != callerCompany {
		return fmt.Errorf("đơn của Shop '%s', bạn là Shop '%s'", order.SellerCompanyID, callerCompany)
	}

	if order.Status != "RETURN_IN_TRANSIT" {
		return fmt.Errorf("trạng thái phải là RETURN_IN_TRANSIT")
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
	order, err := getOrderState(ctx, orderID)
	if err != nil {
		return nil, err
	}
	
	// Lấy thông tin người gọi
	actorOrg, _ := getActorOrg(ctx)
	callerCompany, _ := getCallerCompanyID(ctx)

	// LOGIC PHÂN QUYỀN XEM (Visibility)
	
	// 1. Admin Sàn: Xem hết
	if actorOrg == "ECommercePlatformOrgMSP" {
		return order, nil
	}

	// 2. Seller: Chỉ xem đơn của Shop mình
	if actorOrg == "SellerOrgMSP" {
		if order.SellerCompanyID != "" && order.SellerCompanyID != callerCompany {
			return nil, fmt.Errorf("KHÔNG CÓ QUYỀN: Đơn này của Shop '%s'", order.SellerCompanyID)
		}
		return order, nil
	}

	// 3. Shipper: Chỉ xem đơn của Hãng mình
	if actorOrg == "ShipperOrgMSP" {
		if order.ShipperCompanyID != "" && order.ShipperCompanyID != callerCompany {
			return nil, fmt.Errorf("KHÔNG CÓ QUYỀN: Đơn này của Hãng '%s'", order.ShipperCompanyID)
		}
	return order, nil
}

	return nil, fmt.Errorf("tổ chức '%s' không có quyền truy cập", actorOrg)
}

// [HÀM HELPER] getQueryResult: Chuyển iterator kết quả thành slice of QueryResult
func getQueryResult(resultsIterator shim.StateQueryIteratorInterface) ([]*QueryResult, error) {
	defer resultsIterator.Close()

	var results []*QueryResult
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var order Order
		err = json.Unmarshal(queryResponse.Value, &order)
		if err != nil {
			return nil, err
		}

		queryResult := QueryResult{Key: queryResponse.Key, Record: &order}
		results = append(results, &queryResult)
	}

	return results, nil
}


// -----------------------------------------------------------------------------------
// [HÀM MỚI] QueryOrdersByString: Thực hiện Rich Query (CouchDB)
// -----------------------------------------------------------------------------------
// Logic: Trả về tất cả đơn hàng có sellerCompanyID khớp với query
func (s *SmartContract) QueryOrdersByString(ctx contractapi.TransactionContextInterface, queryString string) ([]*QueryResult, error) {

    // 1. Kiểm tra ACL (Chỉ cho Seller, Shipper, hoặc Sàn truy vấn danh sách)
    actorOrg, err := getActorOrg(ctx)
    if err != nil { return nil, err }

    if actorOrg != "SellerOrgMSP" && actorOrg != "ECommercePlatformOrgMSP" && actorOrg != "ShipperOrgMSP" {
        return nil, fmt.Errorf("KHÔNG CÓ QUYỀN: Tổ chức '%s' không được gọi hàm truy vấn danh sách", actorOrg)
    }

	// 2. Thực hiện Rich Query trên sổ cái
	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, fmt.Errorf("lỗi thực hiện Rich Query: %v", err)
	}

	// 3. Chuyển đổi kết quả Iterator thành slice of QueryResult
	return getQueryResult(resultsIterator)
}

func (s *SmartContract) QueryOrderForOrg(ctx contractapi.TransactionContextInterface, orderID string, requiredMSP string, requiredCompanyID string) (*Order, error) {
    order, err := getOrderState(ctx, orderID)
    if err != nil {
        return nil, err
    }

    // 1. Kiểm tra MSP người gọi (Client Identity)
    actorOrg, _ := getActorOrg(ctx)
    if actorOrg != requiredMSP {
        return nil, fmt.Errorf("KHÔNG CÓ QUYỀN: Bạn phải là %s để truy vấn đơn này.", requiredMSP)
    }

    // 2. Kiểm tra quyền sở hữu bằng CompanyID
    var orderOwnerID string

    if requiredMSP == "SellerOrgMSP" {
        orderOwnerID = order.SellerCompanyID
    } else if requiredMSP == "ShipperOrgMSP" {
        orderOwnerID = order.ShipperCompanyID
    } else {
        // Trường hợp không xác định (nên dùng QueryOrder cho Admin)
        return nil, fmt.Errorf("MSP không hợp lệ cho truy vấn thành viên.")
    }

    // So sánh CompanyID được Chaincode lưu với CompanyID được ứng dụng client truyền vào
    if orderOwnerID != requiredCompanyID {
        return nil, fmt.Errorf("KHÔNG CÓ QUYỀN: Đơn hàng thuộc '%s', bạn là '%s'.", orderOwnerID, requiredCompanyID)
    }

    // Vượt qua kiểm tra
    return order, nil
}
