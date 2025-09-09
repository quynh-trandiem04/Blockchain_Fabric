from odoo import fields, models, _

class PaymentTransaction(models.Model):
    _inherit = "payment.transaction"

    def _get_specific_processing_values(self, processing_values):
        res = super()._get_specific_processing_values(processing_values)
        if self.provider_code != "blockchain":
            return res

        return {
            "provider_code": "blockchain",
            "provider_name": self.provider_id.name,
            "reference": self.reference,
            "amount": self.amount,
        }

    def _process_notification_data(self, notification_data):
        super()._process_notification_data(notification_data)
        if self.provider_code != "blockchain":
            return

        # For blockchain, we'll process based on transaction hash
        tx_hash = notification_data.get('tx_hash')
        if tx_hash:
            self.provider_reference = tx_hash
            self._set_done()

    def _blockchain_form_get_invalid_parameters(self, data):
        # No validation needed for blockchain demo
        return []

    def _blockchain_form_validate(self, data):
        # Mark transaction as done for demo
        self._set_done()
        return True
