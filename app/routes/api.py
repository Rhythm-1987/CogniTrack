from flask import Blueprint, jsonify, request
from flask_login import current_user

from ..services import assessment_service
from ..services.assessment_service import AssessmentError
from ..utils.decorators import login_required_api

api_bp = Blueprint('api', __name__, url_prefix='/api')


@api_bp.errorhandler(AssessmentError)
def handle_assessment_error(err):
    return jsonify({'error': err.message}), err.status_code


def _json_body():
    data = request.get_json(silent=True)
    if data is None:
        raise AssessmentError('Request body must be valid JSON.', 400)
    return data


@api_bp.route('/assessment/start', methods=['POST'])
@login_required_api
def assessment_start():
    body = _json_body()
    result = assessment_service.start_session(
        current_user,
        checkin_data=body.get('checkin') or {},
    )
    return jsonify(result), 200


@api_bp.route('/assessment/save', methods=['POST'])
@login_required_api
def assessment_save():
    body = _json_body()

    assessment_id = body.get('assessment_id')
    domain = body.get('domain')
    if not assessment_id or not domain:
        raise AssessmentError('assessment_id and domain are required.', 400)

    result = assessment_service.save_result(
        current_user,
        assessment_id=assessment_id,
        domain=domain,
        score=body.get('score'),
        accuracy=body.get('accuracy'),
        average_time=body.get('average_time'),
        rating=body.get('rating'),
        raw_data=body.get('raw_data'),
        duration=body.get('duration'),
    )
    return jsonify(result), 200


@api_bp.route('/assessment/complete', methods=['POST'])
@login_required_api
def assessment_complete():
    body = _json_body()

    assessment_id = body.get('assessment_id')
    if not assessment_id:
        raise AssessmentError('assessment_id is required.', 400)

    result = assessment_service.complete_session(current_user, assessment_id)
    return jsonify(result), 200


@api_bp.route('/dashboard', methods=['GET'])
@login_required_api
def dashboard():
    payload = assessment_service.get_dashboard_payload(current_user)
    return jsonify(payload or {}), 200


@api_bp.route('/history', methods=['GET'])
@login_required_api
def history():
    return jsonify(assessment_service.get_history(current_user)), 200
