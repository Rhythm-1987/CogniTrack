from flask import Blueprint, render_template

assessment_bp = Blueprint('assessment', __name__)


@assessment_bp.route('/assessment', methods=['GET', 'POST'])
def assessment():
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
