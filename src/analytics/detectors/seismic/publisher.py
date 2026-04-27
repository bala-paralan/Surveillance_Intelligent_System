"""
Redis publisher for seismic sensor events.

Publishes to channel ``sensor:event:seismic``.

Privacy / logging rules:
  - NEVER log direction_deg or distance_m at INFO level
  - Only log event type and sensor_id
  - Non-fatal on Redis error: warns and continues
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone

from analytics.detectors.seismic.classifier import SeismicEvent

logger = logging.getLogger(__name__)

_REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
_CHANNEL = "sensor:event:seismic"


async def publish_seismic_event(
    sensor_id: str,
    aoi_ids: list[str],
    event: SeismicEvent,
) -> None:
    """
    Publish a seismic event to Redis pub/sub.

    Parameters
    ----------
    sensor_id:
        Identifier of the seismic sensor.
    aoi_ids:
        List of Area-of-Interest identifiers associated with the sensor.
    event:
        Classified seismic event to publish.
    """
    payload = {
        "sensor_id": sensor_id,
        "aoi_ids": aoi_ids,
        "type": event["type"],
        "confidence": event["confidence"],
        "direction_deg": event["direction_deg"],
        "distance_m": event["distance_m"],
        "pattern_window_ms": event["pattern_window_ms"],
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
    }

    logger.info(
        "Seismic event: sensor_id=%s type=%s",
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
            "redis package not available — skipping seismic publish for sensor_id=%s", sensor_id
        )
    except Exception as exc:
        logger.warning(
            "Redis publish to %s failed for sensor_id=%s: %s — continuing",
            _CHANNEL,
            sensor_id,
            exc,
        )
