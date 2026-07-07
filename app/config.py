import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Config:
    DEBUG = os.environ.get('FLASK_DEBUG', '').lower() in ('1', 'true')
