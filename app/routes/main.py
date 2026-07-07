from flask import Blueprint, render_template

main_bp = Blueprint('main', __name__)


@main_bp.route('/')
def index():
    return render_template('pages/index.html')


@main_bp.route('/user', methods=['GET', 'POST'])
def user():
    return render_template('pages/user.html')


@main_bp.route('/results')
def results():
    return render_template('pages/results.html')
