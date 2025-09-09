# payment_blockchain/models/blockchain_simulator.py
import hashlib
import json
import time
from odoo import models, fields, api

class BlockchainSimulator(models.Model):
    _name = 'blockchain.simulator'
    _description = 'Blockchain Simulator'
    _order = 'block_number desc'

    block_number = fields.Integer(string='Block Number', required=True)
    previous_hash = fields.Char(string='Previous Hash', size=64)
    current_hash = fields.Char(string='Current Hash', size=64)
    timestamp = fields.Datetime(string='Timestamp', default=fields.Datetime.now)
    nonce = fields.Integer(string='Nonce', default=0)
    transactions = fields.Text(string='Transactions (JSON)')
    merkle_root = fields.Char(string='Merkle Root', size=64)
    difficulty = fields.Integer(string='Difficulty', default=4)
    is_valid = fields.Boolean(string='Is Valid', default=True, compute='_compute_is_valid', store=True)

    @api.depends('current_hash', 'previous_hash', 'transactions', 'nonce', 'timestamp')
    def _compute_is_valid(self):
        """Validate block integrity"""
        for block in self:
            if block.block_number == 0:  # Genesis block
                block.is_valid = True
            else:
                # Check if hash starts with required zeros (difficulty)
                required_zeros = '0' * block.difficulty
                calculated_hash = self._calculate_hash(
                    block.block_number,
                    block.previous_hash or '',
                    block.transactions or '[]',
                    block.nonce,
                    block.timestamp
                )
                block.is_valid = (
                    block.current_hash == calculated_hash and
                    block.current_hash.startswith(required_zeros)
                )

    def _calculate_hash(self, block_number, previous_hash, transactions, nonce, timestamp):
        """Calculate block hash using SHA-256"""
        timestamp_str = timestamp.strftime('%Y-%m-%d %H:%M:%S') if timestamp else ''
        data = f"{block_number}{previous_hash}{transactions}{nonce}{timestamp_str}"
        return hashlib.sha256(data.encode()).hexdigest()

    def _mine_block(self, block_number, previous_hash, transactions):
        """Mine a new block with Proof of Work"""
        nonce = 0
        difficulty = 4
        target = '0' * difficulty
        timestamp = fields.Datetime.now()
        
        while True:
            hash_result = self._calculate_hash(block_number, previous_hash, transactions, nonce, timestamp)
            if hash_result.startswith(target):
                return {
                    'hash': hash_result,
                    'nonce': nonce,
                    'timestamp': timestamp
                }
            nonce += 1
            # Prevent infinite loop in demo
            if nonce > 100000:
                break
        
        # Fallback if mining takes too long
        return {
            'hash': self._calculate_hash(block_number, previous_hash, transactions, nonce, timestamp),
            'nonce': nonce,
            'timestamp': timestamp
        }

    @api.model
    def create_genesis_block(self):
        """Create the first block in the chain"""
        genesis_exists = self.search([('block_number', '=', 0)], limit=1)
        if genesis_exists:
            return genesis_exists

        genesis_transactions = json.dumps([{
            'type': 'genesis',
            'message': 'Genesis Block - First block in the chain',
            'timestamp': fields.Datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }])

        genesis_hash = self._calculate_hash(0, '0', genesis_transactions, 0, fields.Datetime.now())
        
        return self.create({
            'block_number': 0,
            'previous_hash': '0' * 64,
            'current_hash': genesis_hash,
            'transactions': genesis_transactions,
            'nonce': 0,
            'difficulty': 0,  # No mining for genesis
            'merkle_root': hashlib.sha256(genesis_transactions.encode()).hexdigest()
        })

    @api.model
    def add_transaction_block(self, transaction_data):
        """Add a new block with transaction data"""
        # Get the last block
        last_block = self.search([], limit=1, order='block_number desc')
        if not last_block:
            last_block = self.create_genesis_block()

        # Prepare transaction data
        transactions = json.dumps(transaction_data)
        
        # Mine the new block
        mining_result = self._mine_block(
            last_block.block_number + 1,
            last_block.current_hash,
            transactions
        )

        # Create new block
        new_block = self.create({
            'block_number': last_block.block_number + 1,
            'previous_hash': last_block.current_hash,
            'current_hash': mining_result['hash'],
            'transactions': transactions,
            'nonce': mining_result['nonce'],
            'timestamp': mining_result['timestamp'],
            'merkle_root': hashlib.sha256(transactions.encode()).hexdigest()
        })

        return new_block

    @api.model
    def get_blockchain_status(self):
        """Get current blockchain status"""
        blocks = self.search([], order='block_number asc')
        total_blocks = len(blocks)
        
        # Validate chain integrity
        is_chain_valid = True
        invalid_blocks = []
        
        for i, block in enumerate(blocks):
            if i > 0:  # Skip genesis block
                prev_block = blocks[i-1]
                if block.previous_hash != prev_block.current_hash:
                    is_chain_valid = False
                    invalid_blocks.append(block.block_number)
            
            if not block.is_valid:
                is_chain_valid = False
                invalid_blocks.append(block.block_number)

        return {
            'total_blocks': total_blocks,
            'is_chain_valid': is_chain_valid,
            'invalid_blocks': invalid_blocks,
            'latest_block': blocks[-1].current_hash if blocks else None,
            'blockchain_data': [
                {
                    'block_number': block.block_number,
                    'hash': block.current_hash,
                    'previous_hash': block.previous_hash,
                    'timestamp': block.timestamp.strftime('%Y-%m-%d %H:%M:%S') if block.timestamp else '',
                    'transactions': json.loads(block.transactions or '[]'),
                    'nonce': block.nonce,
                    'is_valid': block.is_valid,
                    'merkle_root': block.merkle_root
                }
                for block in blocks
            ]
        }

    @api.model
    def simulate_blockchain_attack(self, block_number_to_tamper):
        """Simulate tampering with blockchain to show immutability"""
        block_to_tamper = self.search([('block_number', '=', block_number_to_tamper)], limit=1)
        if not block_to_tamper:
            return {'error': 'Block not found'}

        # Tamper with transaction data
        original_transactions = block_to_tamper.transactions
        tampered_transactions = json.dumps([{
            'type': 'tampered',
            'message': 'This block has been tampered with!',
            'original_data': 'MODIFIED'
        }])
        
        block_to_tamper.write({
            'transactions': tampered_transactions
        })

        # Check chain validity after tampering
        status = self.get_blockchain_status()
        
        # Restore original data
        block_to_tamper.write({
            'transactions': original_transactions
        })

        return {
            'tampered_block': block_number_to_tamper,
            'chain_broken': not status['is_chain_valid'],
            'invalid_blocks': status['invalid_blocks'],
            'message': 'Blockchain integrity compromised! This demonstrates immutability.'
        }
