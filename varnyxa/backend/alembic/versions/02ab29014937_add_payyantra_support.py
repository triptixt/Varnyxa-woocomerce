"""add_payyantra_support

Revision ID: 02ab29014937
Revises: 623f5f0249bf
Create Date: 2026-10-19 15:39:59.218336

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '02ab29014937'
down_revision: Union[str, Sequence[str], None] = '623f5f0249bf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema to add PayYantra payment gateway support."""
    # 1. Update PaymentProvider enum in PostgreSQL
    connection = op.get_bind()
    connection.execute(sa.text("COMMIT"))  # Exit active transaction for ALTER TYPE
    connection.execute(sa.text("ALTER TYPE paymentprovider ADD VALUE IF NOT EXISTS 'PAYYANTRA'"))
    connection.execute(sa.text("ALTER TYPE paymentprovider ADD VALUE IF NOT EXISTS 'payyantra'"))
    connection.execute(sa.text("BEGIN"))

    # 2. Add PayYantra columns to payments table
    op.add_column('payments', sa.Column('payyantra_order_id', sa.String(length=100), nullable=True))
    op.add_column('payments', sa.Column('merchant_order_id', sa.String(length=100), nullable=True))
    op.add_column('payments', sa.Column('reference_id', sa.String(length=100), nullable=True))
    op.add_column('payments', sa.Column('transaction_id', sa.String(length=100), nullable=True))
    op.add_column('payments', sa.Column('transaction_public_id', sa.String(length=100), nullable=True))
    op.add_column('payments', sa.Column('checkout_url', sa.Text(), nullable=True))
    op.add_column('payments', sa.Column('rrn', sa.String(length=100), nullable=True))
    op.add_column('payments', sa.Column('payment_method', sa.String(length=50), nullable=True))
    op.add_column('payments', sa.Column('gateway_response', sa.JSON(), nullable=True))
    op.add_column('payments', sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True))

    # 3. Create indexes for quick order reconciliation and status polling
    op.create_index(op.f('ix_payments_payyantra_order_id'), 'payments', ['payyantra_order_id'], unique=True)
    op.create_index(op.f('ix_payments_merchant_order_id'), 'payments', ['merchant_order_id'], unique=True)
    op.create_index(op.f('ix_payments_reference_id'), 'payments', ['reference_id'], unique=False)
    op.create_index(op.f('ix_payments_transaction_id'), 'payments', ['transaction_id'], unique=False)
    op.create_index(op.f('ix_payments_transaction_public_id'), 'payments', ['transaction_public_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_payments_transaction_public_id'), table_name='payments')
    op.drop_index(op.f('ix_payments_transaction_id'), table_name='payments')
    op.drop_index(op.f('ix_payments_reference_id'), table_name='payments')
    op.drop_index(op.f('ix_payments_merchant_order_id'), table_name='payments')
    op.drop_index(op.f('ix_payments_payyantra_order_id'), table_name='payments')

    op.drop_column('payments', 'verified_at')
    op.drop_column('payments', 'gateway_response')
    op.drop_column('payments', 'payment_method')
    op.drop_column('payments', 'rrn')
    op.drop_column('payments', 'checkout_url')
    op.drop_column('payments', 'transaction_public_id')
    op.drop_column('payments', 'transaction_id')
    op.drop_column('payments', 'reference_id')
    op.drop_column('payments', 'merchant_order_id')
    op.drop_column('payments', 'payyantra_order_id')
