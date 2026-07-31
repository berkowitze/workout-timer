"""add parse_events table

Revision ID: 446dd5f985fc
Revises: 5690543eea0b
Create Date: 2026-07-31 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '446dd5f985fc'
down_revision: Union[str, None] = '5690543eea0b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('parse_events',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('session_id', sa.UUID(), nullable=False),
    sa.Column('turn_index', sa.Integer(), nullable=False),
    sa.Column('is_modification', sa.Boolean(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=True),
    sa.Column('anonymous_id', sa.String(length=255), nullable=True),
    sa.Column('prompt_text', sa.Text(), nullable=False),
    sa.Column('input_exercises', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('output_exercises', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('success', sa.Boolean(), nullable=False),
    sa.Column('error_message', sa.Text(), nullable=True),
    sa.Column('model', sa.String(length=100), nullable=False),
    sa.Column('retry_count', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_parse_events_session_id'), 'parse_events', ['session_id'], unique=False)
    op.create_index(op.f('ix_parse_events_user_id'), 'parse_events', ['user_id'], unique=False)
    op.create_index(op.f('ix_parse_events_anonymous_id'), 'parse_events', ['anonymous_id'], unique=False)
    op.create_index(op.f('ix_parse_events_created_at'), 'parse_events', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_parse_events_created_at'), table_name='parse_events')
    op.drop_index(op.f('ix_parse_events_anonymous_id'), table_name='parse_events')
    op.drop_index(op.f('ix_parse_events_user_id'), table_name='parse_events')
    op.drop_index(op.f('ix_parse_events_session_id'), table_name='parse_events')
    op.drop_table('parse_events')
