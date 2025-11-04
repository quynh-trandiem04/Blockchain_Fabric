from odoo import models, fields, api, _
from odoo.exceptions import UserError
import requests 
import logging

_logger = logging.getLogger(__name__)

# ==========================================================
# THAY ĐỊA CHỈ IP MÁY ẢO UBUNTU CỦA MÁY VÀO ĐÂY !!
API_GATEWAY_URL = "http://192.168.40.11:5001" 
# Ví dụ: API_GATEWAY_URL = "http://192.168.1.51:5001"
# ==========================================================

class SaleOrder(models.Model):
    _inherit = 'sale.order'

    blockchain_tx_id = fields.Char(string="Blockchain TX ID", copy=False, readonly=True)

    def _call_blockchain_api(self, endpoint, payload):
        url = f"{API_GATEWAY_URL}{endpoint}"
        _logger.info(f"Đang gọi Blockchain API: {url} với payload: {payload}")

        try:
            response = requests.post(url, json=payload, timeout=10)
            if response.status_code != 200:
                error_data = response.json()
                _logger.error(f"API Gateway báo lỗi: {error_data.get('error')}")
                raise UserError(f"API Gateway báo lỗi: {error_data.get('error')}")
            return response.json()
        except requests.exceptions.ConnectionError:
            _logger.error(f"Không thể kết nối đến API Gateway tại: {url}")
            raise UserError(f"Không thể kết nối đến API Gateway. Hãy đảm bảo API server (Ubuntu) đang chạy và cổng 5001 đã mở.")
        except Exception as e:
            _logger.error(f"Lỗi không xác định khi gọi API: {str(e)}")
            raise UserError(f"Lỗi không xác định: {str(e)}")

    def action_create_order_on_blockchain(self):
        self.ensure_one()
        _logger.info(f"Chuẩn bị ghi đơn hàng {self.name} lên Blockchain...")

        payload = {
            "orderID": self.name, 
            "paymentMethod": "COD", 
            "amount": self.amount_total,
            "sellerID": self.user_id.name or 'DefaultSeller',
            "shipperID": "DefaultShipper", 
            "customerID": self.partner_id.name
        }

        try:
            response_data = self._call_blockchain_api("/api/createOrder", payload)
            self.write({'blockchain_tx_id': response_data.get('tx_id', 'N/A')})
            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'title': 'Thành công!',
                    'message': 'Đã ghi đơn hàng lên Blockchain.',
                    'type': 'success',
                }
            }
        except UserError as e:
            raise e
        except Exception as e:
            _logger.error(f"Lỗi nghiêm trọng khi ghi blockchain: {str(e)}")
            raise UserError(f"Lỗi: {str(e)}")