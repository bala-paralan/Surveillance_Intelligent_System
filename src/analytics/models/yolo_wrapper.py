"""
YOLOv8 inference wrapper.

Attempts to import ultralytics at runtime. If not installed (e.g. in CI/test
environments without GPU or model files), falls back to a deterministic stub
that returns one synthetic person detection so unit tests pass without any
model artefacts.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class Detection:
    """A single object detection result."""

    label: str
    confidence: float
    bbox: tuple[int, int, int, int]  # x1, y1, x2, y2


class _StubModel:
    """Minimal stand-in used when ultralytics is unavailable."""

    def __call__(self, frame: np.ndarray) -> list[object]:  # noqa: ARG002
        return []  # raw results are not used in stub path


class YoloDetector:
    """
    Wraps a YOLOv8 model for person/vehicle/object detection.

    Parameters
    ----------
    model_path:
        Path to a YOLOv8 .pt weights file (e.g. "yolov8n.pt").
        Ignored when ultralytics is unavailable (stub mode).
    device:
        Torch device string — "cpu", "cuda", "mps", etc.
    """

    def __init__(self, model_path: str = "yolov8n.pt", device: str = "cpu") -> None:
        self._stub_mode = False
        try:
            from ultralytics import YOLO  # type: ignore[import-untyped]

            self._model = YOLO(model_path)
            self._model.to(device)
            logger.info("YoloDetector loaded model %s on %s", model_path, device)
        except ImportError:
            logger.warning(
                "ultralytics not installed — YoloDetector running in STUB mode. "
                "Returning synthetic detections for testing purposes only."
            )
            self._stub_mode = True
            self._model = _StubModel()

    def detect(self, frame: np.ndarray) -> list[Detection]:
        """
        Run inference on a single BGR frame.

        Returns a list of Detection objects. In stub mode returns one synthetic
        person detection at the centre of the frame with confidence 0.85.
        """
        if self._stub_mode:
            h, w = frame.shape[:2]
            cx, cy = w // 2, h // 2
            half_w, half_h = max(w // 8, 10), max(h // 8, 10)
            return [
                Detection(
                    label="person",
                    confidence=0.85,
                    bbox=(cx - half_w, cy - half_h, cx + half_w, cy + half_h),
                )
            ]

        results = self._model(frame)
        detections: list[Detection] = []

        try:
            for result in results:
                boxes = result.boxes
                if boxes is None:
                    continue
                for box in boxes:
                    cls_id = int(box.cls[0].item())
                    label: str = result.names[cls_id]
                    conf: float = float(box.conf[0].item())
                    x1, y1, x2, y2 = (int(v.item()) for v in box.xyxy[0])
                    detections.append(
                        Detection(label=label, confidence=conf, bbox=(x1, y1, x2, y2))
                    )
        except Exception as exc:  # pragma: no cover
            logger.error("Error parsing YOLO results: %s", exc)

        return detections
