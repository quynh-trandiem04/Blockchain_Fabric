package main

import (
	"encoding/json"
	"strconv"
	"testing"
	"time"
	"strings"

	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"

	"github.com/golang/protobuf/proto"
	"github.com/stretchr/testify/require"

	msp "github.com/hyperledger/fabric-protos-go/msp"

	"github.com/hyperledger/fabric-chaincode-go/shimtest"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// ===================== Helpers =====================

// Tạo 1 X.509 self-signed cert hợp lệ (ECDSA P-256) để nhét vào SerializedIdentity.IdBytes
func genTestCertPEM(t *testing.T) []byte {
	t.Helper()

	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)

	serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 62))
	require.NoError(t, err)

	tpl := &x509.Certificate{
		SerialNumber:          serial,
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(365 * 24 * time.Hour),
		Subject:               pkix.Name{CommonName: "Fabric Test Identity"}, // <-- dùng pkix.Name
		BasicConstraintsValid: true,
		IsCA:                  true,
		KeyUsage:              x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment | x509.KeyUsageCertSign,
	}

	der, err := x509.CreateCertificate(rand.Reader, tpl, tpl, &priv.PublicKey, priv)
	require.NoError(t, err)

	return pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
}


func newStub(t *testing.T) *shimtest.MockStub {
	cc, err := contractapi.NewChaincode(new(SmartContract))
	require.NoError(t, err)
	return shimtest.NewMockStub("ecommerce", cc)
}

// Gắn Creator với MSPID và 1 PEM cert hợp lệ
func setCreator(t *testing.T, stub *shimtest.MockStub, mspid string) {
	pemCert := genTestCertPEM(t)
	sid := &msp.SerializedIdentity{
		Mspid:   mspid,
		IdBytes: pemCert,
	}
	b, err := proto.Marshal(sid)
	require.NoError(t, err)
	stub.Creator = b
}

// Invoke chaincode bằng MockInvoke (KHÔNG SignedProposal)
func invoke(t *testing.T, stub *shimtest.MockStub, mspid, fn string, args ...string) (int32, []byte, string) {
	setCreator(t, stub, mspid)

	input := make([][]byte, 0, 1+len(args))
	input = append(input, []byte(fn))
	for _, a := range args {
		input = append(input, []byte(a))
	}

	txid := "tx-" + fn + "-" + strconv.FormatInt(time.Now().UnixNano(), 10)
	res := stub.MockInvoke(txid, input)
	return res.Status, res.Payload, res.Message
}

func queryOrder(t *testing.T, stub *shimtest.MockStub, mspid, orderID string) []byte {
	status, payload, msg := invoke(t, stub, mspid, "QueryOrder", orderID)
	require.Equal(t, int32(200), status, msg)
	return payload
}

// Sửa trực tiếp deliveryTimestamp trong state để test mốc thời gian
func patchDeliveryTime(t *testing.T, stub *shimtest.MockStub, orderID string, daysAgo int) {
	state := queryOrder(t, stub, "ECommercePlatformOrgMSP", orderID)

	var order map[string]interface{}
	require.NoError(t, json.Unmarshal(state, &order))

	order["deliveryTimestamp"] = time.Now().
		Add(-time.Duration(daysAgo)*24*time.Hour).
		UTC().
		Format(time.RFC3339Nano)

	updated, err := json.Marshal(order)
	require.NoError(t, err)

	txid := "tx-patch-" + orderID
	stub.MockTransactionStart(txid)
	err = stub.PutState(orderID, updated)
	stub.MockTransactionEnd(txid)
	require.NoError(t, err)
}

// ===================== Test cases =====================

func Test_CreateOrder_PREPAID(t *testing.T) {
	stub := newStub(t)

	st, _, msg := invoke(t, stub, "ECommercePlatformOrgMSP", "CreateOrder",
		"ORD-001", "PREPAID", "100000", "sellerA", "shipperX", "buyerA")
	require.Equal(t, int32(200), st, msg)

	payload := queryOrder(t, stub, "ECommercePlatformOrgMSP", "ORD-001")
	var order struct {
		OrderID string `json:"orderID"`
		Status  string `json:"status"`
	}
	require.NoError(t, json.Unmarshal(payload, &order))
	require.Equal(t, "CREATED", order.Status)
}

func Test_Flow_PREPAID_OK(t *testing.T) {
	stub := newStub(t)

	invoke(t, stub, "ECommercePlatformOrgMSP", "CreateOrder",
		"ORD-100", "PREPAID", "250000", "sellerA", "shipperX", "buyerA")
	invoke(t, stub, "ECommercePlatformOrgMSP", "ConfirmPayment", "ORD-100")
	invoke(t, stub, "SellerOrgMSP", "ShipOrder", "ORD-100")
	invoke(t, stub, "ShipperOrgMSP", "ConfirmDelivery", "ORD-100")

	patchDeliveryTime(t, stub, "ORD-100", 8)

	st, _, msg := invoke(t, stub, "SellerOrgMSP", "PayoutToSeller", "ORD-100")
	require.Equal(t, int32(200), st, msg)
}

func Test_Flow_COD_OK(t *testing.T) {
	stub := newStub(t)

	invoke(t, stub, "ECommercePlatformOrgMSP", "CreateOrder",
		"ORD-200", "COD", "330000", "sellerB", "shipperY", "buyerB")
	invoke(t, stub, "SellerOrgMSP", "ShipOrder", "ORD-200")
	invoke(t, stub, "ShipperOrgMSP", "ConfirmCODDelivery", "ORD-200")
	invoke(t, stub, "ShipperOrgMSP", "RemitCOD", "ORD-200")

	patchDeliveryTime(t, stub, "ORD-200", 8)

	st, _, msg := invoke(t, stub, "SellerOrgMSP", "PayoutToSeller", "ORD-200")
	require.Equal(t, int32(200), st, msg)
}

func Test_Flow_PREPAID_PayoutTooSoon(t *testing.T) {
	stub := newStub(t)

	invoke(t, stub, "ECommercePlatformOrgMSP", "CreateOrder",
		"ORD-300", "PREPAID", "150000", "sellerC", "shipperZ", "buyerC")
	invoke(t, stub, "ECommercePlatformOrgMSP", "ConfirmPayment", "ORD-300")
	invoke(t, stub, "SellerOrgMSP", "ShipOrder", "ORD-300")
	invoke(t, stub, "ShipperOrgMSP", "ConfirmDelivery", "ORD-300")

	st, _, msg := invoke(t, stub, "SellerOrgMSP", "PayoutToSeller", "ORD-300")
	require.Equal(t, int32(500), st)
	require.Contains(t, msg, "chưa đủ 7 ngày")
}
// ===================== EXTRA NEGATIVE & ACL TESTS =====================

func Test_ACL_WrongOrg_Fails(t *testing.T) {
	stub := newStub(t)

	// Tạo PREPAID
	_, _, _ = invoke(t, stub, "ECommercePlatformOrgMSP", "CreateOrder",
		"ORD-ACL1", "PREPAID", "100000", "sellerA", "shipperX", "buyerA")

	// Seller cố ConfirmPayment -> lỗi ACL
	st, _, msg := invoke(t, stub, "SellerOrgMSP", "ConfirmPayment", "ORD-ACL1")
	require.Equal(t, int32(500), st)
	require.Contains(t, msg, "chỉ tổ chức 'ECommercePlatformOrgMSP'")

	// ECommerce cố ConfirmCODDelivery -> lỗi ACL
	st, _, msg = invoke(t, stub, "ECommercePlatformOrgMSP", "ConfirmCODDelivery", "ORD-ACL1")
	require.Equal(t, int32(500), st)
	require.Contains(t, msg, "chỉ tổ chức 'ShipperOrgMSP'")
}

func Test_Transitions_Invalid_Flows(t *testing.T) {
	stub := newStub(t)

	// PREPAID ship khi chưa PAID -> lỗi
	_, _, _ = invoke(t, stub, "ECommercePlatformOrgMSP", "CreateOrder",
		"ORD-T1", "PREPAID", "100000", "seller", "shipper", "buyer")
	st, _, msg := invoke(t, stub, "SellerOrgMSP", "ShipOrder", "ORD-T1")
	require.Equal(t, int32(500), st)
	require.Contains(t, msg, "PREPAID' phải ở trạng thái 'PAID'")

	// COD ship xong rồi ship lại -> lỗi
	_, _, _ = invoke(t, stub, "ECommercePlatformOrgMSP", "CreateOrder",
		"ORD-T2", "COD", "100000", "seller", "shipper", "buyer")
	_, _, _ = invoke(t, stub, "SellerOrgMSP", "ShipOrder", "ORD-T2")
	st, _, _ = invoke(t, stub, "SellerOrgMSP", "ShipOrder", "ORD-T2")
	require.Equal(t, int32(500), st)

	// ConfirmDelivery khi chưa SHIPPED -> lỗi
	_, _, _ = invoke(t, stub, "ECommercePlatformOrgMSP", "CreateOrder",
		"ORD-T3", "PREPAID", "100000", "seller", "shipper", "buyer")
	_, _, _ = invoke(t, stub, "ECommercePlatformOrgMSP", "ConfirmPayment", "ORD-T3")
	st, _, msg = invoke(t, stub, "ShipperOrgMSP", "ConfirmDelivery", "ORD-T3")
	require.Equal(t, int32(500), st)
	require.Contains(t, msg, "phải ở trạng thái 'SHIPPED'")

	// ConfirmCODDelivery cho PREPAID -> lỗi
	_, _, _ = invoke(t, stub, "ECommercePlatformOrgMSP", "CreateOrder",
		"ORD-T4", "PREPAID", "100000", "seller", "shipper", "buyer")
	_, _, _ = invoke(t, stub, "ECommercePlatformOrgMSP", "ConfirmPayment", "ORD-T4")
	_, _, _ = invoke(t, stub, "SellerOrgMSP", "ShipOrder", "ORD-T4")
	st, _, msg = invoke(t, stub, "ShipperOrgMSP", "ConfirmCODDelivery", "ORD-T4")
	require.Equal(t, int32(500), st)
	require.Contains(t, msg, "chỉ dùng cho đơn 'COD'")
}

func Test_Payout_Negatives(t *testing.T) {
	stub := newStub(t)

	// PREPAID payout hai lần: lần 2 phải lỗi
	_, _, _ = invoke(t, stub, "ECommercePlatformOrgMSP", "CreateOrder",
		"ORD-P1", "PREPAID", "100000", "seller", "shipper", "buyer")
	_, _, _ = invoke(t, stub, "ECommercePlatformOrgMSP", "ConfirmPayment", "ORD-P1")
	_, _, _ = invoke(t, stub, "SellerOrgMSP", "ShipOrder", "ORD-P1")
	_, _, _ = invoke(t, stub, "ShipperOrgMSP", "ConfirmDelivery", "ORD-P1")
	patchDeliveryTime(t, stub, "ORD-P1", 8)

	st, _, msg := invoke(t, stub, "SellerOrgMSP", "PayoutToSeller", "ORD-P1")
	require.Equal(t, int32(200), st, msg)

	st, _, msg = invoke(t, stub, "SellerOrgMSP", "PayoutToSeller", "ORD-P1")
	require.Equal(t, int32(500), st)
	require.True(t,
        strings.Contains(msg, "đơn hàng đã được thanh toán (SETTLED)") ||
        strings.Contains(msg, "chỉ có thể thanh toán cho đơn PREPAID đã 'DELIVERED'"),
    	"unexpected error: %s", msg,
	)
	

	// COD: chưa RemitCOD mà Payout -> lỗi
	_, _, _ = invoke(t, stub, "ECommercePlatformOrgMSP", "CreateOrder",
		"ORD-P2", "COD", "100000", "seller", "shipper", "buyer")
	_, _, _ = invoke(t, stub, "SellerOrgMSP", "ShipOrder", "ORD-P2")
	_, _, _ = invoke(t, stub, "ShipperOrgMSP", "ConfirmCODDelivery", "ORD-P2")
	patchDeliveryTime(t, stub, "ORD-P2", 8)

	st, _, msg = invoke(t, stub, "SellerOrgMSP", "PayoutToSeller", "ORD-P2")
	require.Equal(t, int32(500), st)
	require.Contains(t, msg, "DELIVERED' và 'REMITTED'")
}

func Test_Return_Negatives(t *testing.T) {
	stub := newStub(t)

	// Chưa DELIVERED mà RequestReturn -> lỗi
	_, _, _ = invoke(t, stub, "ECommercePlatformOrgMSP", "CreateOrder",
		"ORD-RN1", "PREPAID", "100000", "seller", "shipper", "buyer")
	st, _, msg := invoke(t, stub, "ECommercePlatformOrgMSP", "RequestReturn", "ORD-RN1")
	require.Equal(t, int32(500), st)
	require.Contains(t, msg, "chỉ có thể trả hàng khi đơn ở trạng thái 'DELIVERED'")

	// DELIVERED -> SETTLED rồi mới RequestReturn -> lỗi
	_, _, _ = invoke(t, stub, "ECommercePlatformOrgMSP", "CreateOrder",
		"ORD-RN2", "PREPAID", "100000", "seller", "shipper", "buyer")
	_, _, _ = invoke(t, stub, "ECommercePlatformOrgMSP", "ConfirmPayment", "ORD-RN2")
	_, _, _ = invoke(t, stub, "SellerOrgMSP", "ShipOrder", "ORD-RN2")
	_, _, _ = invoke(t, stub, "ShipperOrgMSP", "ConfirmDelivery", "ORD-RN2")
	patchDeliveryTime(t, stub, "ORD-RN2", 8)
	_, _, _ = invoke(t, stub, "SellerOrgMSP", "PayoutToSeller", "ORD-RN2")

	st, _, _ = invoke(t, stub, "ECommercePlatformOrgMSP", "RequestReturn", "ORD-RN2")
	require.Equal(t, int32(500), st)
}

func Test_CreateOrder_DuplicateID_Fails(t *testing.T) {
	stub := newStub(t)

	st, _, msg := invoke(t, stub, "ECommercePlatformOrgMSP", "CreateOrder",
		"ORD-DUP", "PREPAID", "50000", "seller", "shipper", "buyer")
	require.Equal(t, int32(200), st, msg)

	st, _, msg = invoke(t, stub, "ECommercePlatformOrgMSP", "CreateOrder",
		"ORD-DUP", "PREPAID", "50000", "seller", "shipper", "buyer")
	require.Equal(t, int32(500), st)
	require.Contains(t, msg, "đơn hàng ORD-DUP đã tồn tại")
}

func Test_History_Grows_WithActions(t *testing.T) {
	stub := newStub(t)

	_, _, _ = invoke(t, stub, "ECommercePlatformOrgMSP", "CreateOrder",
		"ORD-H1", "PREPAID", "100000", "seller", "shipper", "buyer")
	payload := queryOrder(t, stub, "ECommercePlatformOrgMSP", "ORD-H1")

	var o struct {
		History []struct {
			TxID string `json:"txID"`
		} `json:"history"`
	}
	require.NoError(t, json.Unmarshal(payload, &o))
	require.Len(t, o.History, 1)
	require.NotEmpty(t, o.History[0].TxID)

	_, _, _ = invoke(t, stub, "ECommercePlatformOrgMSP", "ConfirmPayment", "ORD-H1")
	payload = queryOrder(t, stub, "ECommercePlatformOrgMSP", "ORD-H1")
	o = struct {
		History []struct {
			TxID string `json:"txID"`
		} `json:"history"`
	}{}
	require.NoError(t, json.Unmarshal(payload, &o))
	require.Len(t, o.History, 2)
	require.NotEmpty(t, o.History[1].TxID)
}
