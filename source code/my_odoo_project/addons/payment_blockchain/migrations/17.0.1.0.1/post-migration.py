from odoo import api, SUPERUSER_ID

def migrate(cr, version):
    """Add blockchain_tx_hash column to payment_transaction table."""
    # Check if column already exists
    cr.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='payment_transaction' 
        AND column_name='blockchain_tx_hash'
    """)
    
    if not cr.fetchone():
        # Add the column
        cr.execute("""
            ALTER TABLE payment_transaction 
            ADD COLUMN blockchain_tx_hash VARCHAR
        """)
