from flask import Blueprint, render_template
from flask_login import current_user

from ..services import assessment_service

assessment_bp = Blueprint('assessment', __name__)


@assessment_bp.route('/assessment')
def hub():
    resume_data = None
    assessment_state = None  # None => guest; hub.js falls back to sessionStorage
    if current_user.is_authenticated:
        state = assessment_service.get_user_assessment_state(current_user)
        assessment_state = state['state']
        resume_data = state['resume']
    return render_template(
        'pages/assessment_hub.html',
        resume_data=resume_data,
        assessment_state=assessment_state,
    )


@assessment_bp.route('/assessment/overview', methods=['GET', 'POST'])
def overview():
    return render_template('pages/assessment.html')


@assessment_bp.route('/memory')
def memory():
    return render_template('tests/memory.html')


@assessment_bp.route('/attention')
def attention():
    return render_template('tests/attention.html')


@assessment_bp.route('/executive')
def executive():
    return render_template('tests/executive.html')


@assessment_bp.route('/processing')
def processing():
    return render_template('tests/processing.html')


@assessment_bp.route('/visual')
def visual():
    return render_template('tests/visual.html')
