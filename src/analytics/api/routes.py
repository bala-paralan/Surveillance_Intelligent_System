"""
Analytics API routes.

POST /detect       — run motion + YOLO + intrusion checks on a submitted frame
GET  /health       — liveness / readiness probe
POST /zones        — register/replace zones for a camera
GET  /zones/{camera_id} — retrieve registered zones for a camera
"""
from __future__ import annotations

import io
import json
import logging
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
