from odoo import models, fields, api, _
import logging

try:
    from web3 import Web3
except ImportError:
    Web3 = None

_logger = logging.getLogger(__name__)


class BlockchainTxChecker(models.Model):
    _name = "blockchain.tx.checker"
    _description = "Blockchain Transaction Checker"

    def cron_check_txs(self):
        """Cron job to check pending blockchain transactions"""
        if not Web3:
            _logger.error("web3.py library not installed. Please install it with: pip install web3")
            return

        # Find pending transactions
        pending_orders = self.env['sale.order'].sudo().search([
            ('x_tx_state', '=', 'pending'),
            ('x_tx_hash', '!=', False)
        ])
        
        if not pending_orders:
            _logger.info("No pending blockchain transactions to check")
            return

        # Get blockchain acquirer
        blockchain_acquirer = self.env['payment.acquirer'].sudo().search([
            ('provider', '=', 'blockchain'),
            ('state', '!=', 'disabled')
        ], limit=1)
        
        if not blockchain_acquirer:
            _logger.warning("No active blockchain payment acquirer found")
            return

        if not blockchain_acquirer.blockchain_rpc_url:
            _logger.error("RPC URL not configured for blockchain acquirer")
            return

        try:
            # Initialize Web3 connection
            w3 = Web3(Web3.HTTPProvider(blockchain_acquirer.blockchain_rpc_url))
            
            if not w3.is_connected():
                _logger.error("Cannot connect to blockchain RPC: %s", blockchain_acquirer.blockchain_rpc_url)
                return

            _logger.info("Checking %d pending transactions", len(pending_orders))
            
            for order in pending_orders:
                try:
                    # Get transaction receipt
                    tx_receipt = w3.eth.get_transaction_receipt(order.x_tx_hash)
                    
                    if tx_receipt:
                        if tx_receipt.get('status') == 1:
                            # Transaction successful
                            order.write({'x_tx_state': 'confirmed'})
                            _logger.info("Transaction confirmed for order %s: %s", order.name, order.x_tx_hash)
                            
                            # You might want to trigger payment confirmation here
                            # self._confirm_payment(order, tx_receipt)
                            
                        elif tx_receipt.get('status') == 0:
                            # Transaction failed
                            order.write({'x_tx_state': 'failed'})
                            _logger.warning("Transaction failed for order %s: %s", order.name, order.x_tx_hash)
                    else:
                        # Transaction still pending or not found
                        _logger.info("Transaction still pending for order %s: %s", order.name, order.x_tx_hash)
                        
                except Exception as e:
                    _logger.error("Error checking transaction %s for order %s: %s", 
                                order.x_tx_hash, order.name, str(e))
                    
        except Exception as e:
            _logger.error("Error in blockchain transaction checker: %s", str(e))

    def _confirm_payment(self, order, tx_receipt):
        """Confirm payment for the order"""
        # This method would handle payment confirmation
        # You might want to create a payment.transaction record
        # and confirm the sale order
        pass


class SaleOrder(models.Model):
    _inherit = 'sale.order'
    
    x_tx_hash = fields.Char(
        string="Transaction Hash",
        help="Blockchain transaction hash"
    )
    x_tx_state = fields.Selection([
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('failed', 'Failed')
    ], string="Transaction State", default='pending')
