from flask_login import LoginManager

from .database import db

login_manager = LoginManager()
login_manager.login_view = 'auth.login'
login_manager.login_message = 'Please log in to access this page.'
login_manager.login_message_category = 'info'


@login_manager.user_loader
def load_user(user_id):
    from ..models.user import User
    return db.session.get(User, int(user_id))
