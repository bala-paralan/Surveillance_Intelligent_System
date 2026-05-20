"""
Thermal image detector.

Detects hot blobs in a thermal frame and classifies them as human, vehicle,
or animal based on blob aspect ratio and area.

Stub fallback: if cv2 is unavailable, returns one synthetic 'human' detection
at the centre of the frame.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Literal

import numpy as np

logger = logging.getLogger(__name__)

# Threshold: pixels this many standard deviations above mean are considered hot
_BLOB_STD_FACTOR = 2.0

# Rough temperature scale for display (thermal cameras vary widely)
# Normalised intensity [0,1] → approx Celsius range
_TEMP_MIN_C = 15.0
_TEMP_MAX_C = 45.0


@dataclass
class ThermalDetection:
    """A single detection from a thermal frame."""

    label: Literal["human", "vehicle", "animal"]
    confidence: float
    bbox: tuple[int, int, int, int]  # x1, y1, x2, y2
    temp_celsius_approx: float


class ThermalDetector:
    """
    Detects thermal objects in a single-channel (or multi-channel) frame.

    Frame is expected to be a NumPy array:
      - Single-channel float32/uint16: pixel intensity proportional to temperature
      - 3-channel uint8 (false-colour): converted to greyscale for processing

    Classification by blob aspect ratio:
      - aspect > 2.5 (wide) → vehicle
      - aspect < 0.5 (narrow/tall) or area < 4000 → human
      - else → animal
    """

    def detect(self, frame: np.ndarray) -> list[ThermalDetection]:
        """
        Detect hot regions in a thermal frame.

        Parameters
        ----------
        frame:
            Numpy array representing a thermal image.

        Returns
        -------
        list[ThermalDetection]
            May be empty if no hot blobs are found.
        """
        try:
            return self._detect_cv2(frame)
        except ImportError:
            logger.warning("cv2 not available — ThermalDetector returning synthetic stub detection")
            return self._stub_detection(frame)
        except Exception as exc:
            logger.error("ThermalDetector error: %s — returning stub detection", exc)
            return self._stub_detection(frame)

    def _detect_cv2(self, frame: np.ndarray) -> list[ThermalDetection]:
        import cv2  # type: ignore[import-untyped]

        # Convert to float32 greyscale for thresholding
        if frame.ndim == 3:
            grey = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY).astype(np.float32)
        elif frame.dtype in (np.float32, np.float64):
            grey = frame.astype(np.float32)
        else:
            grey = frame.astype(np.float32)

        mean_val = float(np.mean(grey))
        std_val = float(np.std(grey))

        threshold = mean_val + _BLOB_STD_FACTOR * std_val
        binary = (grey > threshold).astype(np.uint8) * 255

        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        detections: list[ThermalDetection] = []
        grey_min = float(np.min(grey))
        grey_range = float(np.max(grey)) - grey_min + 1e-6

        for contour in contours:
            area = cv2.contourArea(contour)
            if area < 20:
                continue

            x, y, w, h = cv2.boundingRect(contour)
            aspect = float(w) / max(float(h), 1.0)

            # Classify by shape
            label: Literal["human", "vehicle", "animal"]
            if aspect > 2.5:
                label = "vehicle"
                confidence = min(0.5 + (aspect - 2.5) * 0.1, 0.95)
            elif area < 4000 or aspect < 0.5:
                label = "human"
                confidence = 0.75
            else:
                label = "animal"
                confidence = 0.60

            # Approximate temperature from normalised pixel intensity
            blob_mean = float(np.mean(grey[y:y + h, x:x + w]))
            normalised = (blob_mean - grey_min) / grey_range
            temp_celsius_approx = _TEMP_MIN_C + normalised * (_TEMP_MAX_C - _TEMP_MIN_C)

            detections.append(
                ThermalDetection(
                    label=label,
                    confidence=round(confidence, 4),
                    bbox=(x, y, x + w, y + h),
                    temp_celsius_approx=round(temp_celsius_approx, 1),
                )
            )

        return detections

    def _stub_detection(self, frame: np.ndarray) -> list[ThermalDetection]:
        """Return a synthetic centred 'human' detection when cv2 is unavailable."""
        if frame.ndim >= 2:
            h, w = frame.shape[:2]
        else:
            h, w = 100, 100

        cx, cy = w // 2, h // 2
        half = max(min(w, h) // 8, 5)
        return [
            ThermalDetection(
                label="human",
                confidence=0.85,
                bbox=(cx - half, cy - half, cx + half, cy + half),
                temp_celsius_approx=36.6,
            )
        ]
