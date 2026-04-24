"""
Unit tests for TASK-039: Multi-Sensor Fusion Engine.

Covers:
- Event clustering (grouping and splitting)
- Bayesian posterior computation (human, vehicle outcomes)
- Render-hint derivation
- process_window threshold behaviour
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta

import pytest

from analytics.fusion.cluster import SensorEventCluster, cluster_events
from analytics.fusion.bayes import FusionWeights, compute_posterior
from analytics.fusion.engine import FusionEngine
from analytics.fusion.weights_loader import load_weights


# ── Helpers ───────────────────────────────────────────────────────────────────

def _ts(offset_s: float = 0.0) -> str:
    """Return an ISO-8601 timestamp offset_s seconds from a fixed base."""
    base = datetime(2026, 4, 24, 12, 0, 0, tzinfo=timezone.utc)
    return (base + timedelta(seconds=offset_s)).isoformat()


def _default_weights() -> list[FusionWeights]:
    return load_weights()  # always returns defaults (no file)


# ── Clustering tests ──────────────────────────────────────────────────────────


def test_cluster_groups_close_events() -> None:
    """Three events within a 2-second span must land in a single cluster."""
    events = [
        {"id": "e1", "aoi_id": "aoi-A", "type": "seismic_footstep", "ts": _ts(0.0)},
        {"id": "e2", "aoi_id": "aoi-A", "type": "acoustic_voice",    "ts": _ts(1.0)},
        {"id": "e3", "aoi_id": "aoi-A", "type": "seismic_footstep", "ts": _ts(2.0)},
    ]
    clusters = cluster_events(events, time_window_s=3.0)
    assert len(clusters) == 1
    assert clusters[0].aoi_id == "aoi-A"
    assert len(clusters[0].events) == 3


def test_cluster_splits_distant_events() -> None:
    """Two events 10 seconds apart must produce two separate clusters."""
    events = [
        {"id": "e1", "aoi_id": "aoi-B", "type": "seismic_footstep", "ts": _ts(0.0)},
        {"id": "e2", "aoi_id": "aoi-B", "type": "seismic_footstep", "ts": _ts(10.0)},
    ]
    clusters = cluster_events(events, time_window_s=3.0)
    assert len(clusters) == 2


def test_cluster_empty_input_returns_empty() -> None:
    """Empty event list must return an empty cluster list."""
    assert cluster_events([]) == []


# ── Bayesian posterior tests ──────────────────────────────────────────────────


def _single_cluster(
    events: list[dict],  # type: ignore[type-arg]
    aoi_id: str = "aoi-test",
) -> SensorEventCluster:
    ts_list = [datetime.fromisoformat(e["ts"]) for e in events]
    return SensorEventCluster(
        events=events,
        aoi_id=aoi_id,
        first_seen=min(ts_list),
        last_seen=max(ts_list),
        sensor_ids=[str(e.get("sensor_id", "")) for e in events],
    )


def test_posterior_human_from_seismic_footstep() -> None:
    """seismic_footstep + acoustic_voice together should yield human or group."""
    events = [
        {"id": "e1", "aoi_id": "aoi-C", "type": "seismic_footstep", "ts": _ts(0.0)},
        {"id": "e2", "aoi_id": "aoi-C", "type": "acoustic_voice",    "ts": _ts(0.5)},
    ]
    cluster = _single_cluster(events, "aoi-C")
    weights = _default_weights()
    outcome = compute_posterior(cluster, weights)
    assert outcome["outcome_class"] in ("human", "group"), (
        f"Expected human/group but got {outcome['outcome_class']} "
        f"(confidence={outcome['confidence']:.3f})"
    )
    assert 0.0 <= outcome["confidence"] <= 1.0


def test_posterior_vehicle() -> None:
    """seismic_vehicle + acoustic_vehicle should yield vehicle class."""
    events = [
        {"id": "e1", "aoi_id": "aoi-D", "type": "seismic_vehicle",  "ts": _ts(0.0)},
        {"id": "e2", "aoi_id": "aoi-D", "type": "acoustic_vehicle", "ts": _ts(0.3)},
    ]
    cluster = _single_cluster(events, "aoi-D")
    weights = _default_weights()
    outcome = compute_posterior(cluster, weights)
    assert outcome["outcome_class"] == "vehicle", (
        f"Expected vehicle but got {outcome['outcome_class']} "
        f"(confidence={outcome['confidence']:.3f})"
    )


# ── Render-hint tests ─────────────────────────────────────────────────────────


def test_render_hint_human() -> None:
    """Human outcome must produce glyph='footstep_radius'."""
    events = [
        {"id": "e1", "aoi_id": "aoi-E", "type": "seismic_footstep", "ts": _ts(0.0)},
        {"id": "e2", "aoi_id": "aoi-E", "type": "acoustic_voice",    "ts": _ts(0.5)},
    ]
    cluster = _single_cluster(events, "aoi-E")
    weights = _default_weights()
    outcome = compute_posterior(cluster, weights)
    # Only assert render_hint when outcome is human/group
    if outcome["outcome_class"] in ("human", "group"):
        assert outcome["render_hint"]["glyph"] == "footstep_radius"


def test_render_hint_tunnel() -> None:
    """
    A cluster dominated by seismic_tunnel events must produce a tunnel outcome
    with glyph='tunnel' and arc_deg=360.
    """
    events = [
        {"id": "e1", "aoi_id": "aoi-F", "type": "seismic_tunnel", "ts": _ts(0.0)},
        {"id": "e2", "aoi_id": "aoi-F", "type": "seismic_tunnel", "ts": _ts(0.5)},
        {"id": "e3", "aoi_id": "aoi-F", "type": "seismic_tunnel", "ts": _ts(1.0)},
    ]
    cluster = _single_cluster(events, "aoi-F")
    weights = _default_weights()
    outcome = compute_posterior(cluster, weights)
    assert outcome["outcome_class"] == "tunnel"
    assert outcome["render_hint"]["glyph"] == "tunnel"
    assert outcome["render_hint"]["arc_deg"] == 360


# ── process_window threshold tests ───────────────────────────────────────────


def test_process_window_below_threshold_returns_none() -> None:
    """
    A single event with a diffuse type (seismic_noise) that cannot drive any
    class above 0.5 must cause process_window to return None.

    To guarantee the test is threshold-driven rather than outcome-driven we
    inject a custom weight set where all posteriors are equal (flat priors +
    identical likelihoods) so confidence can never exceed 1/8 ≈ 0.125.
    """
    flat_likelihoods = {t: 0.5 for t in [
        "seismic_footstep", "seismic_animal", "seismic_vehicle",
        "seismic_tunnel", "seismic_noise", "acoustic_voice",
        "acoustic_gunshot", "acoustic_vehicle", "acoustic_drone",
        "acoustic_animal", "acoustic_noise", "thermal_human",
        "thermal_vehicle", "lidar_motion", "pan_person", "pan_vehicle",
    ]}
    flat_weights = [
        FusionWeights(class_name=c, prior=0.125, likelihoods=flat_likelihoods)
        for c in ["animal", "human", "group", "vehicle", "drone", "gunshot", "tunnel", "unknown"]
    ]
    engine = FusionEngine(flat_weights)

    events = [
        {"id": "e1", "aoi_id": "aoi-G", "type": "seismic_noise", "ts": _ts(0.0)},
    ]
    result = engine.process_window("aoi-G", events)
    assert result is None


def test_process_window_returns_outcome_above_threshold() -> None:
    """Strong seismic_vehicle + acoustic_vehicle signal must exceed threshold."""
    engine = FusionEngine(_default_weights())
    events = [
        {"id": "e1", "aoi_id": "aoi-H", "type": "seismic_vehicle",  "ts": _ts(0.0)},
        {"id": "e2", "aoi_id": "aoi-H", "type": "acoustic_vehicle", "ts": _ts(0.4)},
        {"id": "e3", "aoi_id": "aoi-H", "type": "pan_vehicle",       "ts": _ts(0.8)},
    ]
    result = engine.process_window("aoi-H", events)
    assert result is not None
    assert result["outcome_class"] == "vehicle"
    assert result["confidence"] >= 0.5
