"""
VAYLUME API — Application entry point.

Registers all routers, configures CORS, sets up structured error handling,
and exposes OpenAPI documentation at /docs.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config.settings import get_settings
from routes import auth, locker, memories, notes, vault

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("vaylume")

settings = get_settings()


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("VAYLUME API starting up — version %s", settings.APP_VERSION)
    yield
    logger.info("VAYLUME API shutting down")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "## VAYLUME — Your Personal AI-Powered Life Organiser\n\n"
        "**Features:**\n"
        "- 🔐 **Authentication** — Supabase Auth (JWT)\n"
        "- 📸 **Memories** — Store photos, titles, descriptions & dates\n"
        "- 🤖 **AI Notes** — Gemini-powered notes in 10 Indian languages\n"
        "- 🗄️ **Digital Locker** — Secure private document storage\n\n"
        "**Authentication:** Send `Authorization: Bearer <token>` on all protected endpoints."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)


# ── CORS ──────────────────────────────────────────────────────────────────────
allowed_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global error handlers ────────────────────────────────────────────────────

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Return clean, structured validation errors — never expose stack traces."""
    errors = []
    for error in exc.errors():
        errors.append({
            "field": " → ".join(str(loc) for loc in error["loc"]),
            "message": error["msg"],
            "type": error["type"],
        })
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"code": "VALIDATION_ERROR", "message": "Invalid input", "details": errors},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Catch-all — log the real error but return a safe message to the client."""
    logger.error("Unhandled exception on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"code": "INTERNAL_ERROR", "message": "An unexpected error occurred"},
    )


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router,     prefix="/api/v1")
app.include_router(vault.router,    prefix="/api/v1")
app.include_router(memories.router, prefix="/api/v1")
app.include_router(notes.router,    prefix="/api/v1")
app.include_router(locker.router,   prefix="/api/v1")


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"], summary="Health check")
def health():
    return {"status": "ok", "version": settings.APP_VERSION}


@app.get("/", tags=["Root"], include_in_schema=False)
def root():
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }
