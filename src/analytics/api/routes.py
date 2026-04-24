"""
Analytics API routes.

POST /detect       — run motion + YOLO + intrusion checks on a submitted frame
GET  /health       — liveness / readiness probe
POST /zones        — register/replace zones for a camera
GET  /zones/{camera_id} — retrieve registered zones for a camera

Phase 0B sensor endpoints:
GET  /analytics/seismic/health   — seismic driver health
POST /analytics/seismic/classify — classify a submitted waveform
GET  /analytics/acoustic/health  — acoustic driver health
POST /analytics/acoustic/classify — classify submitted audio

TASK-039 fusion endpoints:
POST /fusion/process  — synchronous fusion for testing
GET  /fusion/health   — fusion subsystem health
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

import cv2
import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from analytics.detectors.intrusion_detector import (
    IntrusionDetector,
    Zone,
)
from analytics.detectors.motion_detector import MotionDetector
from analytics.models.yolo_wrapper import Detection, YoloDetector
from analytics.api.redis_publisher import publish_detection_event
from analytics.detectors.seismic.classifier import SeismicClassifier
from analytics.detectors.acoustic.classifier import AcousticClassifier
from analytics.fusion.engine import FusionEngine
from analytics.fusion.weights_loader import load_weights
from analytics.fusion.bayes import FusionOutcome

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Module-level singletons ───────────────────────────────────────────────────

_detector: YoloDetector | None = None
_motion_detector = MotionDetector()

# Per-camera previous frames for motion detection
_prev_frames: dict[str, np.ndarray] = {}

# Registered zones: camera_id → list[Zone]
_zone_registry: dict[str, list[Zone]] = {}


def get_detector() -> YoloDetector:
    global _detector  # noqa: PLW0603
    if _detector is None:
        _detector = YoloDetector()
    return _detector


# ── Pydantic models ───────────────────────────────────────────────────────────


class ZoneIn(BaseModel):
    zone_id: str
    camera_id: str
    polygon: list[tuple[float, float]]


class ZoneRegisterBody(BaseModel):
    camera_id: str
    zones: list[ZoneIn]


class DetectionOut(BaseModel):
    label: str
    confidence: float
    bbox: tuple[int, int, int, int]


class IntrusionEventOut(BaseModel):
    zone_id: str
    camera_id: str
    detection: DetectionOut
    confidence: float


class DetectResponse(BaseModel):
    camera_id: str
    detections: list[DetectionOut]
    intrusions: list[IntrusionEventOut]
    motion_detected: bool
    ts: str


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    ts: str


class ZoneRegisterResponse(BaseModel):
    registered: int


class ZoneListResponse(BaseModel):
    camera_id: str
    zones: list[ZoneIn]


# ── Helpers ───────────────────────────────────────────────────────────────────


def _decode_image(data: bytes) -> np.ndarray:
    """Decode raw image bytes to a BGR NumPy array."""
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Could not decode image — unsupported format")
    return img


def _detection_to_out(det: Detection) -> DetectionOut:
    return DetectionOut(label=det.label, confidence=det.confidence, bbox=det.bbox)


# ── Routes ────────────────────────────────────────────────────────────────────


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Liveness probe — always returns 200 ok."""
    return HealthResponse(
        status="ok",
        model_loaded=_detector is not None,
        ts=datetime.now(tz=timezone.utc).isoformat(),
    )


@router.post("/detect", response_model=DetectResponse)
async def detect(
    frame: UploadFile = File(...),
    camera_id: str = Form(...),
    zones: str | None = Form(default=None),
) -> DetectResponse:
    """
    Accepts a multipart upload with:
    - ``frame``      — JPEG/PNG image file
    - ``camera_id``  — string identifier
    - ``zones``      — (optional) JSON array of Zone objects overriding the registry

    Returns detections, intrusions, motion flag, and a timestamp.
    """
    raw = await frame.read()
    img = _decode_image(raw)
    h, w = img.shape[:2]

    # --- Motion detection -------------------------------------------------------
    prev = _prev_frames.get(camera_id)
    motion_detected = _motion_detector.detect(img, prev)
    _prev_frames[camera_id] = img.copy()

    # --- YOLO detection ---------------------------------------------------------
    det = get_detector()
    raw_detections = det.detect(img)
    detection_outs = [_detection_to_out(d) for d in raw_detections]

    # --- Zone resolution --------------------------------------------------------
    active_zones: list[Zone] = []

    if zones is not None:
        try:
            zone_data: list[dict[str, Any]] = json.loads(zones)
            active_zones = [
                Zone(
                    zone_id=z["zone_id"],
                    camera_id=z["camera_id"],
                    polygon=[(p[0], p[1]) for p in z["polygon"]],
                )
                for z in zone_data
            ]
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Invalid zones JSON: {exc}") from exc
    else:
        active_zones = _zone_registry.get(camera_id, [])

    # --- Intrusion detection ----------------------------------------------------
    intrusion_det = IntrusionDetector(active_zones)
    intrusion_events = intrusion_det.check(raw_detections, frame_width=w, frame_height=h)
    intrusion_outs = [
        IntrusionEventOut(
            zone_id=ev.zone_id,
            camera_id=ev.camera_id,
            detection=_detection_to_out(ev.detection),
            confidence=ev.confidence,
        )
        for ev in intrusion_events
    ]

    ts = datetime.now(tz=timezone.utc).isoformat()

    # --- Redis publish (non-fatal) -----------------------------------------------
    try:
        publish_detection_event(
            camera_id,
            {
                "camera_id": camera_id,
                "detections": [d.model_dump() for d in detection_outs],
                "intrusions": [i.model_dump() for i in intrusion_outs],
                "motion_detected": motion_detected,
                "ts": ts,
            },
        )
    except Exception as exc:  # pragma: no cover
        logger.warning("Redis publish error (non-fatal): %s", exc)

    return DetectResponse(
        camera_id=camera_id,
        detections=detection_outs,
        intrusions=intrusion_outs,
        motion_detected=motion_detected,
        ts=ts,
    )


@router.post("/zones", response_model=ZoneRegisterResponse)
def register_zones(body: ZoneRegisterBody) -> ZoneRegisterResponse:
    """Register (or replace) intrusion zones for a camera."""
    _zone_registry[body.camera_id] = [
        Zone(
            zone_id=z.zone_id,
            camera_id=z.camera_id,
            polygon=z.polygon,
        )
        for z in body.zones
    ]
    logger.info(
        "Registered %d zones for camera %s", len(body.zones), body.camera_id
    )
    return ZoneRegisterResponse(registered=len(body.zones))


@router.get("/zones/{camera_id}", response_model=ZoneListResponse)
def get_zones(camera_id: str) -> ZoneListResponse:
    """Return registered zones for a camera (empty list if none)."""
    stored = _zone_registry.get(camera_id, [])
    zones_out = [
        ZoneIn(zone_id=z.zone_id, camera_id=z.camera_id, polygon=z.polygon)
        for z in stored
    ]
    return ZoneListResponse(camera_id=camera_id, zones=zones_out)


# ── TASK-039: Fusion singletons ───────────────────────────────────────────────

_fusion_weights = load_weights()
_fusion_engine = FusionEngine(_fusion_weights)

# ── Phase 0B: Seismic sensor endpoints ───────────────────────────────────────

_seismic_classifier = SeismicClassifier()
_acoustic_classifier = AcousticClassifier()


class SeismicHealthResponse(BaseModel):
    status: str
    driver: str
    scenario: str
    sample_rate: int
    ts: str


class SeismicClassifyRequest(BaseModel):
    waveform: list[float]
    sample_rate: int = 100


class SeismicClassifyResponse(BaseModel):
    type: str
    confidence: float
    direction_deg: float
    distance_m: float
    pattern_window_ms: int


@router.get("/analytics/seismic/health", response_model=SeismicHealthResponse)
def seismic_health() -> SeismicHealthResponse:
    """Liveness probe for the seismic ingestion subsystem."""
    scenario = os.getenv("SEISMIC_SCENARIO", "NORMAL")
    return SeismicHealthResponse(
        status="ok",
        driver="ReferenceSeismicDriver",
        scenario=scenario,
        sample_rate=100,
        ts=datetime.now(tz=timezone.utc).isoformat(),
    )


@router.post("/analytics/seismic/classify", response_model=SeismicClassifyResponse)
def seismic_classify(body: SeismicClassifyRequest) -> SeismicClassifyResponse:
    """
    Classify a submitted seismic waveform (float32 array as JSON list).

    Body:
      { "waveform": [0.0, 0.01, ...], "sample_rate": 100 }
    """
    if len(body.waveform) == 0:
        raise HTTPException(status_code=400, detail="waveform must be non-empty")
    window = np.array(body.waveform, dtype=np.float32)
    event = _seismic_classifier.classify(window, body.sample_rate)
    return SeismicClassifyResponse(
        type=event["type"],
        confidence=event["confidence"],
        direction_deg=event["direction_deg"],
        distance_m=event["distance_m"],
        pattern_window_ms=event["pattern_window_ms"],
    )


# ── Phase 0B: Acoustic sensor endpoints ──────────────────────────────────────


class AcousticHealthResponse(BaseModel):
    status: str
    driver: str
    scenario: str
    ts: str


class AcousticClassifyRequest(BaseModel):
    audio: list[float]
    sample_rate: int = 16000


class AcousticClassifyResponse(BaseModel):
    type: str
    confidence: float
    direction_deg: float
    has_doa: bool


@router.get("/analytics/acoustic/health", response_model=AcousticHealthResponse)
def acoustic_health() -> AcousticHealthResponse:
    """Liveness probe for the acoustic ingestion subsystem."""
    scenario = os.getenv("ACOUSTIC_SCENARIO", "NORMAL")
    return AcousticHealthResponse(
        status="ok",
        driver="ReferenceAcousticDriver",
        scenario=scenario,
        ts=datetime.now(tz=timezone.utc).isoformat(),
    )


@router.post("/analytics/acoustic/classify", response_model=AcousticClassifyResponse)
def acoustic_classify(body: AcousticClassifyRequest) -> AcousticClassifyResponse:
    """
    Classify submitted audio samples (float32 array as JSON list).

    Body:
      { "audio": [0.0, 0.01, ...], "sample_rate": 16000 }

    PRIVACY: this endpoint classifies audio events only — no transcription.
    """
    if len(body.audio) == 0:
        raise HTTPException(status_code=400, detail="audio must be non-empty")
    audio = np.array(body.audio, dtype=np.float32)
    event = _acoustic_classifier.classify(audio, body.sample_rate)
    return AcousticClassifyResponse(
        type=event["type"],
        confidence=event["confidence"],
        direction_deg=event["direction_deg"],
        has_doa=event["has_doa"],
    )


# ── TASK-039: Fusion endpoints ────────────────────────────────────────────────


class FusionRenderHint(BaseModel):
    glyph: str
    radius_m: float | None = None
    bearing_deg: float | None = None
    arc_deg: int | None = None
    decay_s: int | None = None


class FusionOutcomeOut(BaseModel):
    aoi_id: str
    outcome_class: str
    confidence: float
    supporting_event_ids: list[str]
    first_seen: str
    last_seen: str
    render_hint: dict[str, Any]


class FusionProcessRequest(BaseModel):
    events: list[dict[str, Any]]
    time_window_s: float = 3.0


class FusionProcessResponse(BaseModel):
    outcomes: list[FusionOutcomeOut]


class FusionHealthResponse(BaseModel):
    status: str
    weights_loaded: bool
    event_buffer_sizes: dict[str, int]


@router.post("/fusion/process", response_model=FusionProcessResponse)
def fusion_process(body: FusionProcessRequest) -> FusionProcessResponse:
    """
    Synchronous multi-sensor fusion for testing/debugging.

    Body:
      { "events": [ { "aoi_id": "...", "type": "seismic_footstep", "ts": "...", ... }, ... ],
        "time_window_s": 3.0 }

    Returns outcomes for all clusters whose confidence exceeds 0.5.
    """
    from analytics.fusion.cluster import cluster_events as _cluster_events
    from analytics.fusion.bayes import compute_posterior

    if not body.events:
        return FusionProcessResponse(outcomes=[])

    clusters = _cluster_events(body.events, time_window_s=body.time_window_s)
    outcomes: list[FusionOutcomeOut] = []
    for cluster in clusters:
        outcome = compute_posterior(cluster, _fusion_weights)
        if outcome["confidence"] >= 0.5:
            outcomes.append(
                FusionOutcomeOut(
                    aoi_id=outcome["aoi_id"],
                    outcome_class=outcome["outcome_class"],
                    confidence=outcome["confidence"],
                    supporting_event_ids=outcome["supporting_event_ids"],
                    first_seen=outcome["first_seen"],
                    last_seen=outcome["last_seen"],
                    render_hint=outcome["render_hint"],
                )
            )

    return FusionProcessResponse(outcomes=outcomes)


@router.get("/fusion/health", response_model=FusionHealthResponse)
def fusion_health() -> FusionHealthResponse:
    """Liveness probe for the fusion subsystem."""
    return FusionHealthResponse(
        status="ok",
        weights_loaded=len(_fusion_weights) > 0,
        event_buffer_sizes=_fusion_engine.event_buffer_sizes,
    )
