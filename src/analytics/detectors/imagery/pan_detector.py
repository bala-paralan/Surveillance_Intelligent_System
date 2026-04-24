"""
PAN (panchromatic / wide-area optical) camera detector.

Wraps YoloDetector with a slew-aware buffer: caches the last 3 frames and
runs YOLO inference on the middle frame to reduce false detections during
camera slewing.
"""
from __future__ import annotations

import logging
from collections import deque
from typing import Deque

import numpy as np

from analytics.models.yolo_wrapper import Detection, YoloDetector

logger = logging.getLogger(__name__)

_BUFFER_SIZE = 3


class PanDetector:
    """
    Pan-camera object detector with slew-aware buffering.

    Maintains a rolling buffer of the last 3 frames per camera.  YOLO
    inference is performed on the middle (index 1) frame so that brief
    transient blur during camera slewing does not pollute results.

    Parameters
    ----------
    yolo_detector:
        Pre-constructed YoloDetector instance.  If None, a new one is
        created on first use.
    """

    def __init__(self, yolo_detector: YoloDetector | None = None) -> None:
        self._yolo: YoloDetector | None = yolo_detector
        # Per-camera rolling frame buffers
        self._buffers: dict[str, Deque[np.ndarray]] = {}

    def _get_yolo(self) -> YoloDetector:
        if self._yolo is None:
            self._yolo = YoloDetector()
        return self._yolo

    def detect(self, frame: np.ndarray, camera_id: str) -> list[Detection]:
        """
        Run YOLO detection on the middle frame of the camera's rolling buffer.

        Parameters
        ----------
        frame:
            Current BGR frame from the camera.
        camera_id:
            Unique camera identifier used to maintain per-camera buffers.

        Returns
        -------
        list[Detection]
            Detections from YOLO run on the buffered middle frame.
            Returns an empty list until the buffer accumulates 3 frames.
        """
        if camera_id not in self._buffers:
            self._buffers[camera_id] = deque(maxlen=_BUFFER_SIZE)

        self._buffers[camera_id].append(frame)
        buf = self._buffers[camera_id]

        if len(buf) < _BUFFER_SIZE:
            logger.debug(
                "PanDetector: buffer not full for camera_id=%s (%d/%d)",
                camera_id,
                len(buf),
                _BUFFER_SIZE,
            )
            return []

        # Run YOLO on the middle frame (index 1 of a 3-frame buffer)
        middle_frame = list(buf)[1]

        try:
            detections = self._get_yolo().detect(middle_frame)
            logger.debug(
                "PanDetector: camera_id=%s detections=%d", camera_id, len(detections)
            )
            return detections
        except Exception as exc:
            logger.error("PanDetector YOLO inference error for camera_id=%s: %s", camera_id, exc)
            return []
