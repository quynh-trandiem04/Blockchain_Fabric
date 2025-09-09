# payment_blockchain/controllers/main.py
from odoo import http, _, fields
from odoo.http import request
from odoo.addons.payment.controllers.post_processing import PaymentPostProcessing
import json
from datetime import datetime

class BlockchainController(http.Controller):

    @http.route('/payment/blockchain/process', type='json', auth='public', csrf=False)
    def blockchain_process(self, **kwargs):
        """Process blockchain payment transaction."""
        provider_code = kwargs.get('provider_code')
        if provider_code != 'blockchain':
            return {'error': 'Invalid provider'}
        
        # Create or get transaction
        reference = kwargs.get('reference')
        blockchain_tx_hash = kwargs.get('blockchain_tx_hash')
        
        if not reference or not blockchain_tx_hash:
            return {'error': 'Missing reference or transaction hash'}
        
        # Find transaction
        tx = request.env['payment.transaction'].sudo().search([
            ('reference', '=', reference)
        ], limit=1)
        
        if not tx:
            return {'error': 'Transaction not found'}
        
        # Update transaction with blockchain hash (store in provider_reference)
        tx.sudo().write({
            'provider_reference': blockchain_tx_hash,
        })
        tx._set_done()
        
        # Process post-payment automatically
        PaymentPostProcessing().poll_status()
        
        return {
            'redirect_url': '/shop/confirmation',
            'state': tx.state,
            'reference': reference,
            'tx_hash': blockchain_tx_hash
        }

    @http.route('/payment/blockchain/record', type='json', auth='public', csrf=False)
    def blockchain_record_payment(self, **kwargs):
        """Record blockchain payment from integrated Pay Now button."""
        try:
            tx_hash = kwargs.get('tx_hash')
            wallet_address = kwargs.get('wallet_address')
            amount = kwargs.get('amount')
            reference = kwargs.get('reference')
            block_number = kwargs.get('block_number')
            gas_fee = kwargs.get('gas_fee')
            
            if not all([tx_hash, wallet_address, amount, reference]):
                return {'success': False, 'error': 'Missing required payment data'}
            
            # Get current order
            order = request.website.sale_get_order()
            if not order:
                return {'success': False, 'error': 'No active order found'}
            
            # Find or create blockchain payment provider
            provider = request.env['payment.provider'].sudo().search([
                ('code', '=', 'blockchain'),
                ('state', '=', 'enabled')
            ], limit=1)
            
            if not provider:
                return {'success': False, 'error': 'Blockchain payment provider not configured'}
            
            # Create payment transaction
            transaction_vals = {
                'provider_id': provider.id,
                'reference': reference,
                'amount': amount,
                'currency_id': order.currency_id.id,
                'partner_id': order.partner_id.id,
                'sale_order_ids': [(4, order.id)],
                'provider_reference': tx_hash,
                'state': 'done',
                'callback_model_id': request.env['ir.model']._get('sale.order').id,
                'callback_res_id': order.id,
                'callback_method': 'action_confirm',
            }
            
            transaction = request.env['payment.transaction'].sudo().create(transaction_vals)
            
            # Confirm the order
            order.sudo().action_confirm()
            
            return {
                'success': True,
                'tx_hash': tx_hash,
                'transaction_id': transaction.id,
                'redirect_url': '/shop/confirmation',
                'order_id': order.id
            }
            
        except Exception as e:
            return {'success': False, 'error': str(e)}

    @http.route('/shop/cart/clear', type='json', auth='public', csrf=False)
    def clear_cart(self, **kwargs):
        """Clear shopping cart after successful blockchain payment."""
        try:
            # Get current order
            order = request.website.sale_get_order()
            if order and order.state == 'draft':
                # Mark order as sent/paid
                order.action_confirm()
                
                # Clear the session cart
                request.session['sale_order_id'] = None
                request.session['sale_transaction_id'] = None
                
                return {'success': True, 'message': 'Cart cleared successfully'}
            return {'success': False, 'message': 'No active cart found'}
        except Exception as e:
            return {'success': False, 'message': str(e)}

    @http.route('/payment/blockchain/success', type='http', auth='public', website=True)
    def payment_success(self, **kwargs):
        """Handle successful blockchain payment and redirect."""
        tx_hash = kwargs.get('tx_hash')
        reference = kwargs.get('reference')
        
        if tx_hash and reference:
            # Find and update transaction
            tx = request.env['payment.transaction'].sudo().search([
                ('reference', '=', reference)
            ], limit=1)
            
            if tx:
                tx.sudo().write({
                    'provider_reference': tx_hash,
                })
                tx._set_done()
                
                # Clear cart
                order = request.website.sale_get_order()
                if order:
                    order.action_confirm()
                    request.session['sale_order_id'] = None
        
        return request.redirect('/shop/confirmation')

    @http.route('/blockchain/demo', type='http', auth='public', website=True)
    def blockchain_demo_page(self, **kwargs):
        """Simple blockchain demo page"""
        return request.render('payment_blockchain.blockchain_demo_page')

    @http.route('/blockchain/simulator/status', type='json', auth='public', csrf=False)
    def blockchain_status(self, **kwargs):
        """Get blockchain simulator status - Simple version"""
        # Return mock data for demo
        return {
            'total_blocks': 3,
            'is_chain_valid': True,
            'invalid_blocks': [],
            'latest_block': 'a1b2c3d4e5f6...',
            'blockchain_data': [
                {
                    'block_number': 0,
                    'hash': 'genesis123456789abcdef',
                    'previous_hash': '0000000000000000',
                    'timestamp': '2025-09-05 13:00:00',
                    'transactions': [{'type': 'genesis', 'message': 'Genesis Block'}],
                    'nonce': 0,
                    'is_valid': True,
                    'merkle_root': 'merkle123456789'
                },
                {
                    'block_number': 1,
                    'hash': 'block1123456789abcdef',
                    'previous_hash': 'genesis123456789abcdef',
                    'timestamp': '2025-09-05 13:15:00',
                    'transactions': [{'type': 'payment', 'message': 'Demo payment transaction', 'amount': 100}],
                    'nonce': 12345,
                    'is_valid': True,
                    'merkle_root': 'merkle234567890'
                }
            ]
        }

    @http.route('/blockchain/simulator/add_block', type='json', auth='public', csrf=False)
    def add_blockchain_block(self, **kwargs):
        """Add a new block to the blockchain - Simple version"""
        import random
        return {
            'success': True,
            'block_number': random.randint(2, 10),
            'hash': f'block{random.randint(1000, 9999)}abcdef',
            'nonce': random.randint(10000, 99999)
        }

    @http.route('/blockchain/simulator/tamper', type='json', auth='public', csrf=False)
    def tamper_blockchain(self, **kwargs):
        """Simulate blockchain tampering - Simple version"""
        return {
            'tampered_block': 1,
            'chain_broken': True,
            'invalid_blocks': [1, 2],
            'message': 'Blockchain integrity compromised! This demonstrates immutability.'
        }

    @http.route('/blockchain/simulator/reset', type='json', auth='public', csrf=False)
    def reset_blockchain(self, **kwargs):
        """Reset blockchain to genesis only - Simple version"""
        return {'success': True, 'message': 'Blockchain reset to genesis block'}

    @http.route('/blockchain/simulator', type='http', auth='public', website=True)
    def blockchain_simulator_page(self, **kwargs):
        """Blockchain simulator page"""
        return request.render('payment_blockchain.blockchain_simulator_page')

    @http.route('/blockchain/confirm', type='http', auth='public', website=True)
    def simple_confirm(self, **kwargs):
        """Simple confirmation redirect."""
        return request.redirect('/shop/confirmation')

    @http.route('/payment/blockchain/confirm', type='json', auth='public', csrf=False)
    def blockchain_confirm(self, reference=None, tx_hash=None, **kwargs):
        """Frontend gửi reference + tx_hash sau khi ký MetaMask."""
        if not reference or not tx_hash:
            return {"status": "error", "message": "missing reference/tx_hash"}

        tx = request.env['payment.transaction'].sudo().search(
            [('reference', '=', reference)], limit=1
        )
        if not tx:
            return {"status": "error", "message": "transaction not found"}

        # Lưu hash và đặt pending (store in provider_reference)
        tx.sudo().write({'provider_reference': tx_hash})
        tx._set_pending(message=_("Awaiting blockchain confirmation (tx: %s)") % tx_hash)

        return {"status": "ok", "state": tx.state, "tx_hash": tx_hash}

    @http.route('/payment/blockchain/return', type='http', auth='public', methods=['POST'], csrf=False)
    def blockchain_return(self, **kwargs):
        """Handle form submission after blockchain payment."""
        tx_hash = kwargs.get('blockchain_tx_hash')
        reference = kwargs.get('reference')
        
        if tx_hash and reference:
            # Find transaction and update with hash
            tx = request.env['payment.transaction'].sudo().search(
                [('reference', '=', reference)], limit=1
            )
            if tx:
                tx.sudo().write({'provider_reference': tx_hash})
                tx._set_done()
        
        # Redirect to payment status page
        return request.redirect('/payment/status')
        
    @http.route('/blockchain/demo', type='http', auth='public', website=True, csrf=False)
    def blockchain_demo_page(self, **kwargs):
        """Trang demo blockchain độc lập"""
        return request.render('payment_blockchain.blockchain_demo_standalone')
    
    @http.route('/test/demo', type='http', auth='public', csrf=False)
    def test_demo(self, **kwargs):
        """Test route đơn giản"""
        return "<h1>Test Route OK!</h1>"
