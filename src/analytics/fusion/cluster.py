"""
Sensor event clustering for multi-sensor fusion.

Groups raw sensor events by aoi_id using a greedy time-window algorithm:
events are sorted by timestamp and a new cluster is started whenever the
gap to the previous event exceeds time_window_s seconds.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class SensorEventCluster:
    """A group of temporally-close sensor events for the same AOI."""

    events: list[dict]  # type: ignore[type-arg]
    aoi_id: str
    first_seen: datetime
    last_seen: datetime
    sensor_ids: list[str]


def _parse_ts(ts: str | datetime) -> datetime:
    """Parse an ISO-8601 string or pass through a datetime (UTC-aware)."""
    if isinstance(ts, datetime):
        if ts.tzinfo is None:
            return ts.replace(tzinfo=timezone.utc)
        return ts
    dt = datetime.fromisoformat(ts)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def cluster_events(
    events: list[dict],  # type: ignore[type-arg]
    time_window_s: float = 3.0,
) -> list[SensorEventCluster]:
    """
    Group *events* by ``aoi_id`` using a greedy sliding-window algorithm.

    Within each aoi_id bucket the events are sorted by timestamp.  A new
    cluster is opened whenever the gap from the previous event exceeds
    *time_window_s* seconds.

    Parameters
    ----------
    events:
        Raw sensor event dicts.  Each must contain at least::

            {
                "aoi_id": str,
                "ts": str | datetime,   # ISO-8601 or datetime
                "sensor_id": str,       # optional — falls back to ""
                ...
            }
    time_window_s:
        Maximum allowed gap (seconds) between consecutive events inside a
        single cluster.

    Returns
    -------
    list[SensorEventCluster]
        One cluster per contiguous group, ordered by first_seen.
    """
    if not events:
        return []

    # Bucket by aoi_id
    buckets: dict[str, list[dict]] = {}  # type: ignore[type-arg]
    for evt in events:
        aoi_id: str = evt.get("aoi_id", "")
        buckets.setdefault(aoi_id, []).append(evt)

    clusters: list[SensorEventCluster] = []

    for aoi_id, bucket in buckets.items():
        # Sort ascending by timestamp
        sorted_events = sorted(bucket, key=lambda e: _parse_ts(e.get("ts", "1970-01-01T00:00:00Z")))

        current_group: list[dict] = []  # type: ignore[type-arg]
        prev_ts: datetime | None = None

        for evt in sorted_events:
            evt_ts = _parse_ts(evt.get("ts", "1970-01-01T00:00:00Z"))

            if prev_ts is not None:
                gap = (evt_ts - prev_ts).total_seconds()
                if gap > time_window_s:
                    # Flush current group into a cluster
                    clusters.append(_make_cluster(aoi_id, current_group))
                    current_group = []

            current_group.append(evt)
            prev_ts = evt_ts

        if current_group:
            clusters.append(_make_cluster(aoi_id, current_group))

    # Return clusters ordered by first_seen
    clusters.sort(key=lambda c: c.first_seen)
    return clusters


def _make_cluster(aoi_id: str, events: list[dict]) -> SensorEventCluster:  # type: ignore[type-arg]
    timestamps = [_parse_ts(e.get("ts", "1970-01-01T00:00:00Z")) for e in events]
    sensor_ids = list({str(e.get("sensor_id", "")) for e in events})
    return SensorEventCluster(
        events=events,
        aoi_id=aoi_id,
        first_seen=min(timestamps),
        last_seen=max(timestamps),
        sensor_ids=sensor_ids,
    )
