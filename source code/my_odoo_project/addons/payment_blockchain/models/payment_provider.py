from odoo import fields, models, api, _
from odoo.exceptions import ValidationError

class PaymentProvider(models.Model):
    _inherit = "payment.provider"

    code = fields.Selection(
        selection_add=[("blockchain", "Blockchain (MetaMask)")],
        ondelete={"blockchain": "set default"},
    )

    blockchain_rpc_url = fields.Char(string="RPC URL", default="http://127.0.0.1:7545")
    blockchain_chain_id = fields.Char(string="Chain ID", default="1337")
    blockchain_receiver = fields.Char(string="Receiver Address")

    def _get_supported_currencies(self):
        supported_currencies = super()._get_supported_currencies()
        if self.code == "blockchain":
            return supported_currencies
        return supported_currencies

    def _get_specific_rendering_values(self, processing_values):
        """Return blockchain specific rendering values."""
        self.ensure_one()
        if self.code != "blockchain":
            return super()._get_specific_rendering_values(processing_values)
        
        # For blockchain, return minimal values to bypass standard flow
        return {
            'provider_code': 'blockchain',
            'reference': processing_values.get('reference'),
            'amount': processing_values.get('amount'),
            'currency': processing_values.get('currency'),
            'api_url': '',  # Empty to prevent redirect
        }

    def _get_default_payment_method_codes(self):
        """Override to prevent standard payment method creation for blockchain."""
        default_codes = super()._get_default_payment_method_codes()
        if self.code == 'blockchain':
            return []
        return default_codes

    @api.model
    def _get_compatible_providers(self, *args, **kwargs):
        """Override to handle blockchain provider specially."""
        providers = super()._get_compatible_providers(*args, **kwargs)
        # Blockchain provider is handled through template override, no special marking needed
        return providers


class PaymentTransaction(models.Model):
    _inherit = "payment.transaction"

    def _get_specific_processing_values(self, processing_values):
        """Handle blockchain transaction processing - bypass standard flow."""
        if self.provider_code != 'blockchain':
            return super()._get_specific_processing_values(processing_values)
        
        # For blockchain payments, return empty to bypass standard processing
        return {}

    def _send_payment_request(self):
        """Override payment request for blockchain - do nothing as it's handled client-side."""
        if self.provider_code == 'blockchain':
            # Blockchain payments are handled client-side with MetaMask
            # No server-side payment request needed
            return {}
        return super()._send_payment_request()

    def _get_tx_from_notification_data(self, provider_code, notification_data):
        """Override to handle blockchain notifications."""
        if provider_code == 'blockchain':
            reference = notification_data.get('reference')
            if reference:
                return self.search([('reference', '=', reference)], limit=1)
        return super()._get_tx_from_notification_data(provider_code, notification_data)

    def _process_notification_data(self, notification_data):
        """Process blockchain notification data."""
        if self.provider_code == 'blockchain':
            blockchain_tx_hash = notification_data.get('blockchain_tx_hash')
            if blockchain_tx_hash:
                self.provider_reference = blockchain_tx_hash
                self._set_done()
        else:
            super()._process_notification_data(notification_data)
