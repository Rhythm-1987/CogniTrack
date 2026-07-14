"""drop dead cci/risk_level/role columns, add updated_at timestamps and a composite index

Revision ID: 99f8455a6a47
Revises: edfb5a12ceea
Create Date: 2026-07-14 19:05:00.000000

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = '99f8455a6a47'
down_revision = 'edfb5a12ceea'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('role')

    with op.batch_alter_table('assessment_sessions', schema=None) as batch_op:
        batch_op.drop_column('cci')
        batch_op.drop_column('risk_level')
        batch_op.add_column(
            sa.Column(
                'updated_at', sa.DateTime(timezone=True), nullable=False,
                server_default=sa.func.now(),
            )
        )
        batch_op.create_index(
            'ix_assessment_sessions_user_id_status', ['user_id', 'status']
        )

    with op.batch_alter_table('assessment_results', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                'updated_at', sa.DateTime(timezone=True), nullable=False,
                server_default=sa.func.now(),
            )
        )


def downgrade():
    with op.batch_alter_table('assessment_results', schema=None) as batch_op:
        batch_op.drop_column('updated_at')

    with op.batch_alter_table('assessment_sessions', schema=None) as batch_op:
        batch_op.drop_index('ix_assessment_sessions_user_id_status')
        batch_op.drop_column('updated_at')
        batch_op.add_column(sa.Column('risk_level', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('cci', sa.Float(), nullable=True))

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('role', sa.String(length=20), nullable=False, server_default='user'))
