"""
Redis publisher for acoustic sensor events.

Publishes to channel ``sensor:event:acoustic``.

Privacy / logging rules:
  - NEVER log audio features or raw signal data
  - Only log event type and sensor_id
  - Non-fatal on Redis error: warns and continues
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone

from analytics.detectors.acoustic.classifier import AcousticEvent

logger = logging.getLogger(__name__)

_REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
_CHANNEL = "sensor:event:acoustic"


async def publish_acoustic_event(
    sensor_id: str,
    aoi_ids: list[str],
    event: AcousticEvent,
) -> None:
    """
    Publish an acoustic event to Redis pub/sub.

    Parameters
    ----------
    sensor_id:
        Identifier of the acoustic sensor.
    aoi_ids:
        List of Area-of-Interest identifiers associated with the sensor.
    event:
        Classified acoustic event to publish.
    """
    payload = {
        "sensor_id": sensor_id,
        "aoi_ids": aoi_ids,
        "type": event["type"],
        "confidence": event["confidence"],
        "direction_deg": event["direction_deg"],
        "has_doa": event["has_doa"],
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
    }

    # Only log event type and sensor_id — never log audio features
    logger.info(
        "Acoustic event: sensor_id=%s type=%s",
        sensor_id,
        event["type"],
    )

    try:
        import redis as redis_lib  # type: ignore[import-untyped]

        client = redis_lib.Redis.from_url(_REDIS_URL, socket_connect_timeout=2)
        client.publish(_CHANNEL, json.dumps(payload))
        client.close()
    except ImportError:
        logger.warning(
            "redis package not available — skipping acoustic publish for sensor_id=%s", sensor_id
        )
    except Exception as exc:
        logger.warning(
            "Redis publish to %s failed for sensor_id=%s: %s — continuing",
            _CHANNEL,
            sensor_id,
            exc,
        )
