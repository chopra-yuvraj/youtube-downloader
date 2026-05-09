"""
AnyDL Backend Configuration
Environment-based config with sensible defaults for local development.
"""
import os
from pathlib import Path

# ── Server ─────────────────────────────────────────────────────────
HOST: str = os.getenv("HOST", "0.0.0.0")
PORT: int = int(os.getenv("PORT", "8000"))

# ── CORS ───────────────────────────────────────────────────────────
# Comma-separated origins — production frontend hardcoded, env var can extend
_DEFAULT_ORIGINS = "https://somnath-ji.vercel.app,http://localhost:5173,http://localhost:4173"
ALLOWED_ORIGINS: list[str] = os.getenv(
    "ALLOWED_ORIGINS", _DEFAULT_ORIGINS
).split(",")

# ── Downloads ──────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
DOWNLOAD_DIR: Path = BASE_DIR / "downloads"
DOWNLOAD_DIR.mkdir(exist_ok=True)

def _find_cookie_file() -> Path | None:
    """Find cookies.txt across local and Render deployment environments."""
    candidates = [
        BASE_DIR / "cookies.txt",
        BASE_DIR.parent / "backend" / "cookies.txt",  # if BASE_DIR is nested
        Path("/etc/secrets/cookies.txt"),             # Render Docker Secrets (default)
        Path("/etc/secrets/backend/cookies.txt"),     # Render Docker Secrets (with folder)
        Path("/app/cookies.txt"),                     # Docker WORKDIR
        Path("/app/backend/cookies.txt"),             # Docker WORKDIR (with folder)
    ]
    for path in candidates:
        if path.exists() and path.is_file():
            return path
    return None

COOKIE_FILE: Path | None = _find_cookie_file()

# Maximum file size in bytes (default 2 GB)
MAX_FILE_SIZE: int = int(os.getenv("MAX_FILE_SIZE", str(2 * 1024 * 1024 * 1024)))

# How long to keep finished downloads before auto-cleanup (seconds)
FILE_TTL_SECONDS: int = int(os.getenv("FILE_TTL_SECONDS", "3600"))

# Cleanup sweep interval (seconds)
CLEANUP_INTERVAL: int = int(os.getenv("CLEANUP_INTERVAL", "600"))

# ── Rate Limiting ──────────────────────────────────────────────────
RATE_LIMIT: str = os.getenv("RATE_LIMIT", "30/minute")
