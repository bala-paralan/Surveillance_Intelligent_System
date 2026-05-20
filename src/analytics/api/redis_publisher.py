"""
Redis pub/sub publisher for detection events.

Non-fatal: if Redis is unavailable (not installed, unreachable, or mis-
configured), a warning is logged and the caller continues normally.
"""
from __future__ import annotations

import json
import logging
import os

logger = logging.getLogger(__name__)

_REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")


def publish_detection_event(camera_id: str, event: dict) -> None:  # type: ignore[type-arg]
    """
    Publish *event* to the Redis channel ``detections:{camera_id}``.

    Parameters
    ----------
    camera_id:
        Identifier of the camera that produced the detection.
    event:
        Serialisable dict (will be JSON-encoded before publishing).
    """
    channel = f"detections:{camera_id}"
    try:
        import redis as redis_lib  # type: ignore[import-untyped]

        client = redis_lib.Redis.from_url(_REDIS_URL, socket_connect_timeout=2)
        client.publish(channel, json.dumps(event))
        client.close()
    except ImportError:
        logger.warning("redis package not available — skipping pub/sub publish to %s", channel)
    except Exception as exc:
        logger.warning(
            "Redis publish to channel %s failed: %s — continuing without pub/sub",
            channel,
            exc,
        )
