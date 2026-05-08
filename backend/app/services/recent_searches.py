"""
Recent Searches Persistent Store — data/searches/recent_searches.json
-----------------------------------------------------------------------
Provides stable, server-side storage for the Event Sources "Recent Searches"
dropdown.  All reads and writes go through this module so that:

  - Searches survive server restarts and browser refreshes.
  - Duplicate entries are never stored (most-recent entry wins its position).
  - The list is capped at MAX_RECENT_SEARCHES (default 30).
  - Concurrent writes are handled with a file-level write-atomic pattern
    (write to tmp → rename) to avoid partial-file corruption.

Exported helpers used by main.py:
  get_recent_searches()       → list[str]
  add_recent_search(location) → list[str]
  clear_recent_searches()     → list[str]
"""
import os
import json
import logging
import tempfile
import shutil

logger = logging.getLogger(__name__)

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
SEARCHES_DIR = os.path.join(_BACKEND_DIR, "data", "searches")
SEARCHES_FILE = os.path.join(SEARCHES_DIR, "recent_searches.json")

os.makedirs(SEARCHES_DIR, exist_ok=True)

MAX_RECENT_SEARCHES = 30


def _load_raw() -> list:
    """Read from disk; return [] on any error."""
    if not os.path.exists(SEARCHES_FILE):
        return []
    try:
        with open(SEARCHES_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            return [s for s in data if isinstance(s, str) and s.strip()]
    except Exception as exc:
        logger.warning(f"Could not read recent_searches.json: {exc}")
    return []


def _save_raw(searches: list) -> None:
    """Atomically write list to disk."""
    try:
        fd, tmp_path = tempfile.mkstemp(dir=SEARCHES_DIR, suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(searches, f, indent=2, ensure_ascii=False)
        except Exception:
            os.unlink(tmp_path)
            raise
        shutil.move(tmp_path, SEARCHES_FILE)
    except Exception as exc:
        logger.error(f"Failed to persist recent_searches.json: {exc}")


# ── Public API ──────────────────────────────────────────────────────────────────

def get_recent_searches() -> list:
    """Return the current ordered list (most-recent first)."""
    return _load_raw()


def add_recent_search(location: str) -> list:
    """
    Prepend *location* to the list (deduplicating and trimming to MAX).
    Returns the updated list.
    """
    location = location.strip()
    if not location:
        return get_recent_searches()

    existing = _load_raw()
    # Remove any existing entry with the same value (case-insensitive would be
    # too aggressive; keep exact-match dedup which is already useful)
    deduped = [s for s in existing if s != location]
    updated = [location] + deduped
    updated = updated[:MAX_RECENT_SEARCHES]
    _save_raw(updated)
    logger.info(f"Added '{location}' to recent searches ({len(updated)} total)")
    return updated


def clear_recent_searches() -> list:
    """Wipe all recent searches. Returns []."""
    _save_raw([])
    logger.info("Cleared all recent searches")
    return []
