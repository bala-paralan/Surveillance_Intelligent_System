"""
Publish FusionOutcome objects to the Redis ``fusion:outcome`` channel.

Non-fatal: a Redis error is logged as a warning and the caller continues
normally.  Credentials are never logged.
"""
from __future__ import annotations

import json
import logging
import os

from analytics.fusion.bayes import FusionOutcome

logger = logging.getLogger(__name__)

_REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
_CHANNEL = "fusion:outcome"


def publish_fusion_outcome(outcome: FusionOutcome) -> None:
    """
    Serialise *outcome* and publish it to the ``fusion:outcome`` Redis channel.

    Parameters
    ----------
    outcome:
        The FusionOutcome TypedDict returned by :func:`~analytics.fusion.bayes.compute_posterior`.
    """
    try:
        import redis as redis_lib  # type: ignore[import-untyped]

        client = redis_lib.Redis.from_url(_REDIS_URL, socket_connect_timeout=2)
        # Publish only non-sensitive fields — never coords or raw payloads
        payload = {
            "aoi_id": outcome["aoi_id"],
            "outcome_class": outcome["outcome_class"],
            "confidence": outcome["confidence"],
            "supporting_event_ids": outcome["supporting_event_ids"],
            "first_seen": outcome["first_seen"],
            "last_seen": outcome["last_seen"],
            "render_hint": outcome["render_hint"],
        }
        client.publish(_CHANNEL, json.dumps(payload))
        client.close()
    except ImportError:
        logger.warning("redis package not available — skipping publish to %s", _CHANNEL)
    except Exception as exc:
        logger.warning(
            "Redis publish to %s failed (non-fatal): %s", _CHANNEL, type(exc).__name__
        )
