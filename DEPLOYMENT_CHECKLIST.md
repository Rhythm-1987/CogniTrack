# CogniTrack — Production Deployment Checklist (Sprint 7.5)

Target topology (confirmed): **whole Flask app → Render** (single Gunicorn service serving
templates, static files, and `/api/*`), **database → Supabase Postgres**. No separate
frontend deploy to Vercel — the app is server-rendered, not a split SPA/API.

## Audit results, item by item

1. **`run.py`** — OK. `app = create_app()` at module scope, `app.run(debug=...)` only fires
   under `if __name__ == '__main__'`, which Gunicorn never executes. No changes needed.
2. **`create_app()`** — OK. Already refuses to start outside `DEBUG` mode without a real
   `SECRET_KEY` (`app/__init__.py:28`). Blueprints, extensions, error handlers all wired
   correctly.
3. **`requirements.txt`** — OK, `gunicorn` and `psycopg2-binary` both present and pinned.
4. **`vercel.json`** — **Removed.** It deployed the whole Flask app to Vercel via
   `@vercel/python`, which conflicted with the Render decision and wasn't a fit for this app
   anyway (persistent DB pool, Flask-Login sessions, Flask-Migrate, and the in-memory rate
   limiter all assume a long-running process, not stateless serverless functions).
5. **SQLite assumptions** — Only one SQLite-specific code path exists
   (`app/core/database.py`'s `PRAGMA foreign_keys=ON` listener), and it's already correctly
   gated to only fire for `sqlite3` connections — a no-op against Postgres. No other model or
   query relies on SQLite-only behavior. Nothing to change.
6. **`DATABASE_URL` from environment only** — OK, with one real bug fixed: Supabase/Render
   connection strings can use the legacy `postgres://` scheme, which SQLAlchemy 2.x rejects
   outright (`NoSuchModuleError`). Added a normalization shim in `app/config.py` that rewrites
   `postgres://` → `postgresql://` before it reaches SQLAlchemy. Falls back to local SQLite
   only when `DATABASE_URL` is unset.
7. **`SECRET_KEY` from environment only** — OK. Enforced at startup outside `DEBUG` mode
   (`app/__init__.py:28-33`); never silently falls back to a random per-process key in
   production.
8. **Flask-Migrate** — OK. `migrations/env.py` pulls the engine from
   `current_app.extensions['migrate']`, not a hardcoded URL — will migrate whatever
   `DATABASE_URL` points at. `alembic.ini` has no hardcoded `sqlalchemy.url`. 5 migrations
   present and look sequential/consistent.
9. **SQLAlchemy configuration** — OK. `pool_pre_ping: True` is already set, which matters for
   Supabase (connections behind a pooler get closed idle). `SQLALCHEMY_TRACK_MODIFICATIONS`
   correctly disabled.
10. **Gunicorn command** — Verify at Render setup time; app object is named `app` in
    `run.py`, so the start command is:
    ```
    gunicorn run:app
    ```
    Recommend starting with a single worker (`-w 1`) unless you also move the rate limiter
    storage to Redis — see note under item 19.
11. **Static files** — OK. All static assets are served via `url_for('static', filename=...)`;
    Flask's built-in static handler works fine on Render's persistent filesystem. No hardcoded
    paths.
12. **Template paths** — OK. Default Flask template folder (`app/templates`) is used
    throughout; no blueprint overrides a custom `template_folder`. All `render_template()`
    calls reference paths that exist under `app/templates/`.
13. **Blueprint registration** — OK. All 5 blueprints (`main`, `assessment`, `dashboard`,
    `auth`, `api`) are registered in `create_app()`. No route prefix collisions.
14. **CORS** — Not required and correctly absent. Since everything is served same-origin
    (Flask serves the pages and the JS calls `/api/*` on the same host), no `flask-cors`
    dependency or `Access-Control-*` headers are needed. Do not add CORS unless the topology
    changes later.
15. **Production config** — OK, `app/config.py` is env-driven throughout: `SECRET_KEY`,
    `DATABASE_URL`, `FLASK_DEBUG`, `RATELIMIT_STORAGE_URI` are all read from the environment
    with safe defaults for local dev only.
16. **`DEBUG=False` in production** — OK by construction: `DEBUG` is only `True` when
    `FLASK_DEBUG` is explicitly set to `1`/`true`. Just make sure `FLASK_DEBUG` is **not** set
    in Render's environment variables (leave it unset, don't set it to `0` vs. omit — both
    work, but omitting is clearer).
17. **Hardcoded localhost URLs** — None found. The only `http://` matches in the repo are the
    SVG XML namespace (`http://www.w3.org/2000/svg`) and an Alembic doc-comment URL — both
    harmless false positives.
18. **API URLs** — All frontend `fetch()` calls hit relative paths (`/api/...`); nothing
    hardcodes a host. No changes needed for the same-origin topology.
19. **Cookies / session configuration** — OK. `SESSION_COOKIE_HTTPONLY=True`,
    `SESSION_COOKIE_SAMESITE='Lax'`, `SESSION_COOKIE_SECURE=not DEBUG` (so cookies are
    `Secure` automatically in production, and Render serves HTTPS by default so this works
    without extra config).
    - **Known limitation, not fixed here (needs your call):** `RATELIMIT_STORAGE_URI`
      defaults to in-process memory (`app/core/extensions.py:13`). If Render ever runs more
      than one Gunicorn worker or more than one instance, each process gets its own counter,
      so the effective rate limit is `N ×` what's configured. Fine for a single worker on a
      single instance; if you scale up, set `RATELIMIT_STORAGE_URI` to a Redis URL (Render
      offers a Redis add-on).
20. This file.

## Additional fix made: pinned Python version

The local `.venv` runs **Python 3.14.4**, but Render currently only supports **Python 3.8
through 3.13**. Without a pin, Render would fall back to its own default (3.11.10 as of this
writing) — a version never tested against this codebase. Added a `.python-version` file at
the repo root pinning to `3.13`, matching what Render actually supports.

## Files changed this sprint

- `app/config.py` — normalize `postgres://` → `postgresql://` in `DATABASE_URL`.
- `vercel.json` — deleted (see item 4).
- `.python-version` — added, pins Render's build to Python 3.13.

No routes, templates, models, or JS were touched — behavior is unchanged.

## Manual steps before going live (not code — do these in each provider's dashboard)

- [ ] **Supabase**: create the Postgres project, copy the connection string (prefer the
      *direct* connection for running migrations; the pooled connection on port 6543 is fine
      for app runtime with `psycopg2`).
- [ ] **Render**: create a Web Service from this repo.
  - [ ] Build command: `pip install -r requirements.txt`
  - [ ] Start command: `gunicorn run:app`
  - [ ] Environment variables: `SECRET_KEY` (generate with
        `python -c "import secrets; print(secrets.token_hex(32))"`), `DATABASE_URL` (from
        Supabase), leave `FLASK_DEBUG` unset.
  - [ ] Confirm Render picks up `.python-version` (3.13) in the build log.
- [ ] Run `flask db upgrade` (via Render's shell, or a one-off job) against the Supabase
      `DATABASE_URL` before first traffic, to create the schema.
- [ ] Smoke-test after deploy: register a user, log in, run one assessment end-to-end, check
      the dashboard renders — confirms DB writes, session cookies, and static assets all work
      against the real production config.
