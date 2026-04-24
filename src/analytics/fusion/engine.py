"""
FusionEngine — subscribes to all ``sensor:event:*`` Redis channels, maintains
per-AOI sliding event windows, and publishes FusionOutcome objects whenever
Bayesian confidence exceeds 0.5.

The :meth:`FusionEngine.process_window` method is purely synchronous so it
can be tested without Redis.
"""
from __future__ import annotations

import json
import logging
from collections import deque
from datetime import datetime, timezone
from typing import Any

from analytics.fusion.bayes import FusionOutcome, FusionWeights, compute_posterior
from analytics.fusion.cluster import cluster_events
from analytics.fusion.publisher import publish_fusion_outcome

logger = logging.getLogger(__name__)

_CONFIDENCE_THRESHOLD = 0.5
_MAX_BUFFER_SIZE = 100
_TIME_WINDOW_S = 3.0
_SENSOR_CHANNELS = [
    "sensor:event:seismic",
    "sensor:event:acoustic",
    "sensor:event:thermal",
    "sensor:event:lidar",
    "sensor:event:pan",
]


class FusionEngine:
    """Multi-sensor fusion engine."""

    def __init__(self, weights: list[FusionWeights]) -> None:
        self._weights = weights
        # Per-AOI sliding event buffer: aoi_id → deque of event dicts
        self._buffers: dict[str, deque[dict[str, Any]]] = {}

    # ── Synchronous processing (testable without Redis) ───────────────────────

    def process_window(
        self,
        aoi_id: str,
        events: list[dict[str, Any]],
    ) -> FusionOutcome | None:
        """
        Run clustering + Bayesian inference on *events* for *aoi_id*.

        Returns the highest-confidence :class:`~analytics.fusion.bayes.FusionOutcome`
        if confidence ≥ 0.5, otherwise ``None``.

        This method is synchronous and fully testable without a live Redis
        connection.
        """
        if not events:
            return None

        clusters = cluster_events(events, time_window_s=_TIME_WINDOW_S)
        if not clusters:
            return None

        best: FusionOutcome | None = None
        for cluster in clusters:
            outcome = compute_posterior(cluster, self._weights)
            if outcome["confidence"] >= _CONFIDENCE_THRESHOLD:
                if best is None or outcome["confidence"] > best["confidence"]:
                    best = outcome

        return best

    # ── Async Redis subscriber loop ───────────────────────────────────────────

    async def run(self, redis_url: str = "redis://localhost:6379") -> None:
        """
        Subscribe to all ``sensor:event:*`` channels and process incoming events.

        This method runs indefinitely (until cancelled).  On each incoming
        message the per-AOI buffer is updated and fusion is attempted.  If
        confidence exceeds the threshold the outcome is published to
        ``fusion:outcome``.

        Sensitive event coordinates are never logged.
        """
        try:
            import redis.asyncio as aioredis  # type: ignore[import-untyped]
        except ImportError:
            logger.error(
                "redis[asyncio] package not available — FusionEngine.run() cannot start"
            )
            return

        client: Any = aioredis.Redis.from_url(redis_url)
        pubsub = client.pubsub()
        await pubsub.psubscribe("sensor:event:*")
        logger.info("FusionEngine subscribed to sensor:event:* channels")

        try:
            async for message in pubsub.listen():
                if message["type"] not in ("pmessage", "message"):
                    continue
                await self._handle_message(message)
        except Exception as exc:
            logger.error("FusionEngine subscription error: %s", type(exc).__name__)
        finally:
            await pubsub.unsubscribe()
            await client.aclose()

    async def _handle_message(self, message: dict[str, Any]) -> None:
        """Parse an incoming Redis message and update the AOI buffer."""
        try:
            raw_data = message.get("data", b"")
            if isinstance(raw_data, (bytes, bytearray)):
                raw_data = raw_data.decode("utf-8")

            event: dict[str, Any] = json.loads(raw_data)
        except Exception:
            return  # Malformed message — skip silently

        aoi_id: str = str(event.get("aoi_id", ""))
        if not aoi_id:
            return

        # Stamp event with current time if missing
        if "ts" not in event:
            event = {**event, "ts": datetime.now(tz=timezone.utc).isoformat()}

        # Maintain per-AOI deque buffer
        if aoi_id not in self._buffers:
            self._buffers[aoi_id] = deque(maxlen=_MAX_BUFFER_SIZE)
        self._buffers[aoi_id].append(event)

        # Run fusion over current buffer
        window = list(self._buffers[aoi_id])
        outcome = self.process_window(aoi_id, window)

        if outcome is not None:
            logger.info(
                "FusionEngine: outcome_class=%s aoi_id=%s confidence=%.3f",
                outcome["outcome_class"],
                outcome["aoi_id"],
                outcome["confidence"],
            )
            publish_fusion_outcome(outcome)

    @property
    def event_buffer_sizes(self) -> dict[str, int]:
        """Return current buffer length per aoi_id (for health checks)."""
        return {aoi_id: len(buf) for aoi_id, buf in self._buffers.items()}
