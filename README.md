# Relay collaborative editor

Relay is a small collaborative writing app built with Django, Django REST Framework, Django Channels, Redis, and React. It includes document sharing with owner/editor/viewer/no-access levels, live presence and cursor locations, file actions, and an IndexedDB draft cache that can restore edits after the browser or network goes offline.

## Run locally

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

The default development database is SQLite. The Channels in-memory layer supports collaboration while running one backend process. Set `REDIS_URL=redis://127.0.0.1:6379/0` to use Redis for shared websocket groups across backend workers.

### Frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), create an account, make a document, then share it with another account by username. To work offline, open a document once while online; later edits are stored in this browser's IndexedDB and merged when it reconnects.

### Docker Compose

From the repository root, run `docker compose up --build` and visit [http://localhost:5173](http://localhost:5173). Compose starts the backend, frontend, and Redis, with SQLite data persisted in a named volume. Copy `.env.example` to `.env` before using a non-local environment.

## Features

- Account registration and token-based sign in.
- Create, rename, duplicate, delete, search, and export documents as Markdown, plain text, or JSON.
- Share by username with editor, viewer, and no-access settings. Only the owner can change sharing or delete a document.
- Live document updates use a 650 ms client debounce and a server revision check. Concurrent stale snapshots are reconciled in the browser with diff-match-patch before retrying.
- Live presence and cursor locations show collaborators and their approximate line and column.
- Every local edit is written to IndexedDB. Reconnection merges a pending local draft with the latest server version. A small service worker caches the app shell and built assets so the editor can reopen offline after its first visit.
- Document lists defer the large content field, use bounded pagination, prefetch memberships, and use owner/access indexes. The websocket persists only changed content.

## Production notes

Set `DJANGO_DEBUG=false`, use a long random `DJANGO_SECRET_KEY`, set `DJANGO_ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS`, and configure a managed PostgreSQL `DATABASE_URL` plus Redis `REDIS_URL`. Serve the React production build over HTTPS and run Daphne behind a reverse proxy that supports WebSockets. The included Compose file is a development setup; add TLS, database backups, and production secret management before a public deployment.

## Checks

```bash
cd backend && python manage.py test documents
cd ../frontend && npm run build && npm audit
```
