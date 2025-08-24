import web3
from web3 import Web3

print("--- Bắt đầu script ---")

# 1. Kết nối tới Ganache
GANACHE_URL = "http://127.0.0.1:7545"
w3 = Web3(Web3.HTTPProvider(GANACHE_URL))

if not w3.is_connected():
    print("Kết nối thất bại.")
    exit()

print("Kết nối tới Ganache thành công!")

# Lấy tài khoản
account_1 = w3.eth.accounts[0]
account_2 = w3.eth.accounts[1]

# !!! QUAN TRỌNG: Đảm bảo đây là private key đúng từ Ganache của bạn !!!
private_key_1 = "0x25f0e3b775643c42e78bc0189c2f5fb180f56ee4187fecdbd3f40a2a11ec6fbf"

# Tạo đối tượng giao dịch
tx = {
    'nonce': w3.eth.get_transaction_count(account_1),
    'to': account_2,
    'value': w3.to_wei(0.01, 'ether'),
    'gas': 21000,
    'gasPrice': w3.to_wei('10', 'gwei')
}

print("\n--- Đã tạo đối tượng giao dịch ---")

# Ký giao dịch bằng private key
signed_tx = w3.eth.account.sign_transaction(tx, private_key_1)

# Gửi giao dịch đã ký bằng thuộc tính đúng: raw_transaction
tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)

print(f"Đã gửi giao dịch thành công! Hash: {w3.to_hex(tx_hash)}")

# Chờ xác nhận
print("Đang chờ xác nhận...")
tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

print("\n!!! GIAO DỊCH THÀNH CÔNG !!!")
print(f"Giao dịch đã được xác nhận trong Block số: {tx_receipt.blockNumber}")

# Kiểm tra lại số dư sau khi gửi
new_balance_1_eth = w3.from_wei(w3.eth.get_balance(account_1), 'ether')
print(f"Số dư mới của ví {account_1}: {new_balance_1_eth} ETH")