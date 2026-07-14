from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import event
from sqlalchemy.engine import Engine

db = SQLAlchemy()


@event.listens_for(Engine, 'connect')
def _enforce_sqlite_foreign_keys(dbapi_connection, connection_record):
    """SQLite ignores FOREIGN KEY / ON DELETE CASCADE declarations unless a
    connection explicitly turns enforcement on — without this, every FK
    column and cascade declared on the models is purely decorative
    against the local sqlite backend (Postgres in production enforces
    natively, so this is a no-op there). Checked against the DBAPI
    connection's own module rather than app config so it works correctly
    regardless of how many engines/apps exist in the process."""
    if type(dbapi_connection).__module__.startswith('sqlite3'):
        cursor = dbapi_connection.cursor()
        cursor.execute('PRAGMA foreign_keys=ON')
        cursor.close()
