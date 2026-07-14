"""add check constraints for score accuracy status age ranges

Revision ID: edfb5a12ceea
Revises: ba233e13e734
Create Date: 2026-07-14 18:12:40.819402

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'edfb5a12ceea'
down_revision = 'ba233e13e734'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('assessment_sessions', schema=None) as batch_op:
        batch_op.create_check_constraint(
            'ck_assessment_sessions_status', "status IN ('in_progress', 'completed')"
        )
        batch_op.create_check_constraint(
            'ck_assessment_sessions_overall_score_range',
            'overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 100)',
        )
        batch_op.create_check_constraint(
            'ck_assessment_sessions_duration_nonneg', 'duration IS NULL OR duration >= 0'
        )

    with op.batch_alter_table('assessment_results', schema=None) as batch_op:
        batch_op.create_check_constraint(
            'ck_assessment_results_score_range', 'score IS NULL OR (score >= 0 AND score <= 100)'
        )
        batch_op.create_check_constraint(
            'ck_assessment_results_accuracy_range', 'accuracy IS NULL OR (accuracy >= 0 AND accuracy <= 100)'
        )

    with op.batch_alter_table('profiles', schema=None) as batch_op:
        batch_op.create_check_constraint(
            'ck_profiles_age_range', 'age IS NULL OR (age >= 1 AND age <= 120)'
        )


def downgrade():
    with op.batch_alter_table('profiles', schema=None) as batch_op:
        batch_op.drop_constraint('ck_profiles_age_range', type_='check')

    with op.batch_alter_table('assessment_results', schema=None) as batch_op:
        batch_op.drop_constraint('ck_assessment_results_accuracy_range', type_='check')
        batch_op.drop_constraint('ck_assessment_results_score_range', type_='check')

    with op.batch_alter_table('assessment_sessions', schema=None) as batch_op:
        batch_op.drop_constraint('ck_assessment_sessions_duration_nonneg', type_='check')
        batch_op.drop_constraint('ck_assessment_sessions_overall_score_range', type_='check')
        batch_op.drop_constraint('ck_assessment_sessions_status', type_='check')
