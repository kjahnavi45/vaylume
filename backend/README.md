# VAYLUME Backend

AI-powered personal organiser API — built with **FastAPI**, **Supabase**, and **Google Gemini**.

---

## Quick Start

### 1. Install dependencies

```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Open .env and fill in your Supabase + Gemini credentials
```

### 3. Set up the database

Run [`database/schema.sql`](database/schema.sql) in your Supabase SQL Editor.
Then create two **private** Storage buckets: `memories` and `locker`.

### 4. Run the server

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API docs: **http://localhost:8000/docs**

---

## Project Structure

```
backend/
├── main.py                     # FastAPI app, CORS, global error handlers
├── requirements.txt
├── .env.example                # Copy to .env — never commit real .env
├── .gitignore
│
├── config/
│   └── settings.py             # Pydantic-Settings — all config from env
│
├── models/
│   └── schemas.py              # Pydantic request/response schemas
│
├── routes/
│   ├── auth.py                 # POST /auth/signup, /login, /logout, /forgot-password; GET /auth/me
│   ├── memories.py             # CRUD /memories
│   ├── notes.py                # POST /notes/generate
│   └── locker.py               # Upload/list/get/delete /locker/files
│
├── services/
│   ├── auth_service.py         # Supabase Auth delegation
│   ├── ai_service.py           # Gemini note generation
│   ├── storage_service.py      # File upload/download/delete
│   └── database_service.py     # Supabase PostgREST CRUD wrapper
│
├── utils/
│   └── dependencies.py         # Shared FastAPI dependencies (JWT extraction)
│
└── database/
    └── schema.sql              # Full Supabase PostgreSQL schema + RLS policies
```

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/signup` | ✗ | Register |
| POST | `/api/v1/auth/login` | ✗ | Login |
| POST | `/api/v1/auth/logout` | ✓ | Logout |
| POST | `/api/v1/auth/forgot-password` | ✗ | Password reset email |
| GET  | `/api/v1/auth/me` | ✓ | Current user |
| POST | `/api/v1/memories` | ✓ | Create memory (multipart) |
| GET  | `/api/v1/memories` | ✓ | List memories |
| GET  | `/api/v1/memories/{id}` | ✓ | Get memory |
| PUT  | `/api/v1/memories/{id}` | ✓ | Update memory |
| DELETE | `/api/v1/memories/{id}` | ✓ | Delete memory |
| POST | `/api/v1/notes/generate` | ✓ | AI note generation |
| POST | `/api/v1/locker/upload` | ✓ | Upload document |
| GET  | `/api/v1/locker/files` | ✓ | List documents |
| GET  | `/api/v1/locker/files/{id}` | ✓ | Get document + signed URL |
| DELETE | `/api/v1/locker/files/{id}` | ✓ | Delete document |
| GET  | `/health` | ✗ | Health check |

---

## Authentication

All protected endpoints require:

```
Authorization: Bearer <supabase_access_token>
```

Obtain the token from `/api/v1/auth/login` → `access_token`.

---

## AI Notes — Supported Languages

English · Telugu · Hindi · Gujarati · Marathi · Kannada · Tamil · Malayalam · Bengali · Punjabi

---

## Security Notes

- Passwords are **never** stored or logged — delegated fully to Supabase Auth
- All files are stored in **private** buckets; access via short-lived signed URLs (1 hour)
- File paths are namespaced: `<bucket>/<user_id>/<uuid>.<ext>`
- Row Level Security (RLS) is enabled on every table
- Secrets live only in `.env` — never in code or logs
- CORS origins are configurable via `ALLOWED_ORIGINS` in `.env`
