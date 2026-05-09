"""
URL validation and sanitization utilities.
Prevents SSRF and ensures only YouTube URLs are processed.
"""
import re

# Strict whitelist of YouTube URL patterns
_YOUTUBE_REGEX = re.compile(
    r"^https?://(www\.)?"
    r"(youtube\.com/(watch\?v=|shorts/|embed/|playlist\?list=)"
    r"|youtu\.be/)"
    r"[\w\-]+"
)


def validate_youtube_url(url: str) -> str:
    """
    Validate and return a sanitized YouTube URL.
    Raises ValueError if the URL is not a valid YouTube link.
    """
    url = url.strip()

    if not url:
        raise ValueError("URL cannot be empty")

    if len(url) > 2048:
        raise ValueError("URL is too long")

    if not _YOUTUBE_REGEX.match(url):
        raise ValueError(
            "Invalid YouTube URL. Accepted formats: "
            "youtube.com/watch?v=..., youtu.be/..., youtube.com/shorts/..."
        )

    return url


def sanitize_filename(filename: str) -> str:
    """
    Strip any path components from a filename to prevent path traversal.
    Only allows alphanumeric, hyphens, dots, and underscores.
    """
    # Take only the basename (strips ../ etc.)
    import os
    name = os.path.basename(filename)

    # Whitelist characters
    name = re.sub(r"[^a-zA-Z0-9.\-_]", "", name)

    if not name:
        raise ValueError("Invalid filename")

    return name
