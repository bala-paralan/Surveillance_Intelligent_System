"""
Naive-Bayes posterior computation for multi-sensor fusion.

Given a SensorEventCluster the module computes P(class | evidence) using:

    posterior(c) ∝ prior(c) × ∏ likelihood(sensor_type | c)   for every event

The class with the highest normalised posterior is the *outcome_class*.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import TypedDict

from analytics.fusion.cluster import SensorEventCluster

# ── Default weights (hardcoded fallback) ─────────────────────────────────────
#
# Sensor types used as keys in likelihoods:
#   seismic_footstep, seismic_vehicle, seismic_tunnel, seismic_animal,
#   seismic_noise, acoustic_voice, acoustic_gunshot, acoustic_vehicle,
#   acoustic_drone, acoustic_animal, acoustic_noise,
#   thermal_human, thermal_vehicle, lidar_motion, pan_person, pan_vehicle
#
# All likelihoods must be > 0 to avoid zero-product collapse; use a small
# floor (0.05) for sensor types that are unlikely but possible.

_FLOOR = 0.05

DEFAULT_WEIGHTS: list[dict] = [  # type: ignore[type-arg]
    {
        "class_name": "animal",
        "prior": 0.15,
        "likelihoods": {
            "seismic_footstep": 0.35,
            "seismic_animal": 0.80,
            "seismic_vehicle": 0.05,
            "seismic_tunnel": 0.05,
            "seismic_noise": 0.20,
            "acoustic_voice": 0.05,
            "acoustic_gunshot": 0.05,
            "acoustic_vehicle": 0.05,
            "acoustic_drone": 0.05,
            "acoustic_animal": 0.85,
            "acoustic_noise": 0.20,
            "thermal_human": 0.10,
            "thermal_vehicle": 0.05,
            "lidar_motion": 0.40,
            "pan_person": 0.05,
            "pan_vehicle": 0.05,
        },
    },
    {
        "class_name": "human",
        "prior": 0.20,
        "likelihoods": {
            "seismic_footstep": 0.85,
            "seismic_animal": 0.10,
            "seismic_vehicle": 0.05,
            "seismic_tunnel": 0.10,
            "seismic_noise": 0.15,
            "acoustic_voice": 0.90,
            "acoustic_gunshot": 0.30,
            "acoustic_vehicle": 0.05,
            "acoustic_drone": 0.05,
            "acoustic_animal": 0.05,
            "acoustic_noise": 0.15,
            "thermal_human": 0.90,
            "thermal_vehicle": 0.05,
            "lidar_motion": 0.70,
            "pan_person": 0.90,
            "pan_vehicle": 0.05,
        },
    },
    {
        "class_name": "group",
        "prior": 0.10,
        "likelihoods": {
            "seismic_footstep": 0.80,
            "seismic_animal": 0.15,
            "seismic_vehicle": 0.05,
            "seismic_tunnel": 0.15,
            "seismic_noise": 0.20,
            "acoustic_voice": 0.80,
            "acoustic_gunshot": 0.35,
            "acoustic_vehicle": 0.05,
            "acoustic_drone": 0.05,
            "acoustic_animal": 0.05,
            "acoustic_noise": 0.20,
            "thermal_human": 0.85,
            "thermal_vehicle": 0.05,
            "lidar_motion": 0.75,
            "pan_person": 0.85,
            "pan_vehicle": 0.05,
        },
    },
    {
        "class_name": "vehicle",
        "prior": 0.15,
        "likelihoods": {
            "seismic_footstep": 0.05,
            "seismic_animal": 0.05,
            "seismic_vehicle": 0.90,
            "seismic_tunnel": 0.10,
            "seismic_noise": 0.20,
            "acoustic_voice": 0.05,
            "acoustic_gunshot": 0.10,
            "acoustic_vehicle": 0.90,
            "acoustic_drone": 0.05,
            "acoustic_animal": 0.05,
            "acoustic_noise": 0.15,
            "thermal_human": 0.05,
            "thermal_vehicle": 0.90,
            "lidar_motion": 0.70,
            "pan_person": 0.05,
            "pan_vehicle": 0.90,
        },
    },
    {
        "class_name": "drone",
        "prior": 0.08,
        "likelihoods": {
            "seismic_footstep": 0.05,
            "seismic_animal": 0.05,
            "seismic_vehicle": 0.05,
            "seismic_tunnel": 0.05,
            "seismic_noise": 0.10,
            "acoustic_voice": 0.05,
            "acoustic_gunshot": 0.05,
            "acoustic_vehicle": 0.05,
            "acoustic_drone": 0.90,
            "acoustic_animal": 0.05,
            "acoustic_noise": 0.15,
            "thermal_human": 0.15,
            "thermal_vehicle": 0.10,
            "lidar_motion": 0.50,
            "pan_person": 0.05,
            "pan_vehicle": 0.05,
        },
    },
    {
        "class_name": "gunshot",
        "prior": 0.07,
        "likelihoods": {
            "seismic_footstep": 0.10,
            "seismic_animal": 0.05,
            "seismic_vehicle": 0.05,
            "seismic_tunnel": 0.05,
            "seismic_noise": 0.15,
            "acoustic_voice": 0.15,
            "acoustic_gunshot": 0.95,
            "acoustic_vehicle": 0.05,
            "acoustic_drone": 0.05,
            "acoustic_animal": 0.05,
            "acoustic_noise": 0.10,
            "thermal_human": 0.20,
            "thermal_vehicle": 0.05,
            "lidar_motion": 0.30,
            "pan_person": 0.20,
            "pan_vehicle": 0.05,
        },
    },
    {
        "class_name": "tunnel",
        "prior": 0.05,
        "likelihoods": {
            "seismic_footstep": 0.20,
            "seismic_animal": 0.05,
            "seismic_vehicle": 0.10,
            "seismic_tunnel": 0.95,
            "seismic_noise": 0.15,
            "acoustic_voice": 0.10,
            "acoustic_gunshot": 0.05,
            "acoustic_vehicle": 0.10,
            "acoustic_drone": 0.05,
            "acoustic_animal": 0.05,
            "acoustic_noise": 0.20,
            "thermal_human": 0.10,
            "thermal_vehicle": 0.05,
            "lidar_motion": 0.40,
            "pan_person": 0.05,
            "pan_vehicle": 0.05,
        },
    },
    {
        "class_name": "unknown",
        "prior": 0.20,
        "likelihoods": {
            "seismic_footstep": 0.25,
            "seismic_animal": 0.25,
            "seismic_vehicle": 0.25,
            "seismic_tunnel": 0.25,
            "seismic_noise": 0.50,
            "acoustic_voice": 0.25,
            "acoustic_gunshot": 0.25,
            "acoustic_vehicle": 0.25,
            "acoustic_drone": 0.25,
            "acoustic_animal": 0.25,
            "acoustic_noise": 0.50,
            "thermal_human": 0.25,
            "thermal_vehicle": 0.25,
            "lidar_motion": 0.50,
            "pan_person": 0.25,
            "pan_vehicle": 0.25,
        },
    },
]


# ── Dataclass / TypedDict interfaces ─────────────────────────────────────────


@dataclass
class FusionWeights:
    class_name: str
    prior: float
    likelihoods: dict[str, float]


class FusionOutcome(TypedDict):
    aoi_id: str
    outcome_class: str
    confidence: float
    supporting_event_ids: list[str]
    first_seen: str
    last_seen: str
    render_hint: dict  # type: ignore[type-arg]


# ── Render-hint builder ───────────────────────────────────────────────────────


def _build_render_hint(
    outcome_class: str,
    cluster: SensorEventCluster,
) -> dict:  # type: ignore[type-arg]
    """Derive a TASK-038 compatible render_hint from the outcome class."""
    avg_distance_m: float = 500.0
    avg_direction_deg: float = 0.0
    distances = [float(e.get("distance_m", 500.0)) for e in cluster.events if "distance_m" in e]
    directions = [float(e.get("direction_deg", 0.0)) for e in cluster.events if "direction_deg" in e]

    if distances:
        avg_distance_m = sum(distances) / len(distances)
    if directions:
        avg_direction_deg = sum(directions) / len(directions)

    hints: dict[str, object] = {}

    if outcome_class in ("human", "group"):
        hints = {
            "glyph": "footstep_radius",
            "radius_m": avg_distance_m,
        }
    elif outcome_class == "tunnel":
        hints = {
            "glyph": "tunnel",
            "bearing_deg": 0,
            "arc_deg": 360,
        }
    elif outcome_class == "vehicle":
        hints = {
            "glyph": "vehicle",
            "bearing_deg": avg_direction_deg,
        }
    elif outcome_class == "gunshot":
        hints = {
            "glyph": "gunshot",
            "decay_s": 30,
        }
    elif outcome_class == "drone":
        hints = {
            "glyph": "drone",
            "bearing_deg": 0,
        }
    elif outcome_class == "animal":
        hints = {
            "glyph": "animal",
            "radius_m": 200,
        }
    else:  # unknown
        hints = {
            "glyph": "unknown",
            "decay_s": 20,
        }

    return hints


# ── Core computation ──────────────────────────────────────────────────────────


def compute_posterior(
    cluster: SensorEventCluster,
    weights: list[FusionWeights],
) -> FusionOutcome:
    """
    Compute the Bayesian posterior over all outcome classes for *cluster*.

    The algorithm:
    1. For each class ``c`` compute the unnormalised score::

           score(c) = prior(c) × ∏_{event in cluster} likelihood[event.type](c)

       where ``event.type`` is the sensor event type (lower-cased, e.g.
       ``"seismic_footstep"``).  Unknown event types fall back to the floor
       value ``_FLOOR``.

    2. Normalise all scores so they sum to 1.0.
    3. The class with the highest normalised posterior becomes
       ``outcome_class``; its probability becomes ``confidence``.

    Returns
    -------
    FusionOutcome
    """
    # Use log-space arithmetic to avoid float underflow on long event lists
    log_scores: dict[str, float] = {}

    for fw in weights:
        log_score = math.log(fw.prior)
        for evt in cluster.events:
            etype = str(evt.get("type", "")).lower()
            lk = fw.likelihoods.get(etype, _FLOOR)
            log_score += math.log(max(lk, 1e-9))
        log_scores[fw.class_name] = log_score

    # Convert back to linear; normalise
    max_log = max(log_scores.values())
    raw: dict[str, float] = {cls: math.exp(ls - max_log) for cls, ls in log_scores.items()}
    total = sum(raw.values())
    posteriors: dict[str, float] = {cls: v / total for cls, v in raw.items()}

    outcome_class = max(posteriors, key=lambda c: posteriors[c])
    confidence = posteriors[outcome_class]

    supporting_event_ids: list[str] = [str(e.get("id", "")) for e in cluster.events if e.get("id")]

    render_hint = _build_render_hint(outcome_class, cluster)

    return FusionOutcome(
        aoi_id=cluster.aoi_id,
        outcome_class=outcome_class,
        confidence=confidence,
        supporting_event_ids=supporting_event_ids,
        first_seen=cluster.first_seen.isoformat(),
        last_seen=cluster.last_seen.isoformat(),
        render_hint=render_hint,
    )
