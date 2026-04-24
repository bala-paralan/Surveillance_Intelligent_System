"""
Redis publisher for imagery sensor events (thermal, LiDAR, PAN).

Channels:
  - sensor:event:thermal
  - sensor:event:lidar
  - sensor:event:pan

Privacy / logging rules:
  - Never log raw frame data or point-cloud coordinates
  - Only log sensor_type, sensor_id, and detection count
  - Non-fatal on Redis error
"""
from __future__ import annotations

import json
import logging
import os
from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

_REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

_CHANNELS: dict[str, str] = {
    "thermal": "sensor:event:thermal",
    "lidar": "sensor:event:lidar",
    "pan": "sensor:event:pan",
}


def _serialize_detection(det: Any) -> dict[str, Any]:
    """Convert a dataclass detection to a JSON-serialisable dict."""
    try:
        return asdict(det)  # type: ignore[arg-type]
    except Exception:
        return {"raw": str(det)}


async def publish_imagery_event(
    sensor_type: str,
    sensor_id: str,
    aoi_ids: list[str],
    detections: list[Any],
) -> None:
    """
    Publish an imagery event to Redis pub/sub.

    Parameters
    ----------
    sensor_type:
        One of ``"thermal"``, ``"lidar"``, ``"pan"``.
    sensor_id:
        Unique identifier for the sensor.
    aoi_ids:
        Area-of-Interest IDs associated with the sensor.
    detections:
        List of detection dataclasses (ThermalDetection, LidarEvent, Detection).
    """
    channel = _CHANNELS.get(sensor_type.lower())
    if channel is None:
        logger.warning("Unknown imagery sensor_type '%s' — skipping publish", sensor_type)
        return

    serialised = [_serialize_detection(d) for d in detections]

    payload = {
        "sensor_type": sensor_type,
        "sensor_id": sensor_id,
        "aoi_ids": aoi_ids,
        "detections": serialised,
        "count": len(detections),
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
    }

    logger.info(
        "Imagery event: sensor_type=%s sensor_id=%s detections=%d",
        sensor_type,
        sensor_id,
        len(detections),
    )

    try:
        import redis as redis_lib  # type: ignore[import-untyped]

        client = redis_lib.Redis.from_url(_REDIS_URL, socket_connect_timeout=2)
        client.publish(channel, json.dumps(payload))
        client.close()
    except ImportError:
        logger.warning(
            "redis package not available — skipping imagery publish for sensor_id=%s", sensor_id
        )
    except Exception as exc:
        logger.warning(
            "Redis publish to %s failed for sensor_id=%s: %s — continuing",
            channel,
            sensor_id,
            exc,
        )
