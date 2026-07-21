"""add medication_cognitive_effect to checkin fields

Revision ID: 389ef716a5e6
Revises: f415a080b250
Create Date: 2026-07-21 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '389ef716a5e6'
down_revision = 'f415a080b250'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('assessment_sessions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('medication_cognitive_effect', sa.String(length=20), nullable=True))

    with op.batch_alter_table('guest_assessment_sessions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('medication_cognitive_effect', sa.String(length=20), nullable=True))


def downgrade():
    with op.batch_alter_table('guest_assessment_sessions', schema=None) as batch_op:
        batch_op.drop_column('medication_cognitive_effect')

    with op.batch_alter_table('assessment_sessions', schema=None) as batch_op:
        batch_op.drop_column('medication_cognitive_effect')
