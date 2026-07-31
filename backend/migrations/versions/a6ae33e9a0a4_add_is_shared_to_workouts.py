"""add is_shared to workouts

Revision ID: a6ae33e9a0a4
Revises: 446dd5f985fc
Create Date: 2026-07-31 17:55:55.785970

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a6ae33e9a0a4'
down_revision: Union[str, None] = '446dd5f985fc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Existing rows were all created through the current explicit "Save as
    # Shared" flow, so they're all shared. New rows default to False at the
    # ORM level (private, auto-created behind a run) unless promoted.
    op.add_column(
        'workouts',
        sa.Column('is_shared', sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.alter_column('workouts', 'is_shared', server_default=None)


def downgrade() -> None:
    op.drop_column('workouts', 'is_shared')
