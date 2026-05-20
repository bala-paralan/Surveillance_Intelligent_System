"""
Unit tests for MotionDetector, IntrusionDetector, and YoloDetector (stub).
"""
from __future__ import annotations

import numpy as np
import pytest

from analytics.detectors.motion_detector import MotionDetector
from analytics.detectors.intrusion_detector import Detection, IntrusionDetector, Zone
from analytics.models.yolo_wrapper import YoloDetector


# ── MotionDetector ────────────────────────────────────────────────────────────


class TestMotionDetector:
    def test_motion_detector_no_motion(self) -> None:
        """Two identical frames must not trigger a motion event."""
        frame = np.full((240, 320, 3), 128, dtype=np.uint8)
        detector = MotionDetector(threshold=25, min_area=500)

        assert detector.detect(frame, frame) is False

    def test_motion_detector_detects_motion(self) -> None:
        """A large filled rectangle on an otherwise dark frame triggers motion."""
        prev = np.zeros((240, 320, 3), dtype=np.uint8)
        curr = np.zeros((240, 320, 3), dtype=np.uint8)
        # Draw a 100×100 white rectangle — area = 10 000 px² >> min_area=500
        curr[70:170, 110:210] = 255

        detector = MotionDetector(threshold=25, min_area=500)
        assert detector.detect(curr, prev) is True

    def test_motion_detector_no_prev_frame(self) -> None:
        """First call with prev_frame=None must always return False."""
        frame = np.zeros((240, 320, 3), dtype=np.uint8)
        detector = MotionDetector()
        assert detector.detect(frame, None) is False

    def test_motion_detector_invalid_threshold(self) -> None:
        with pytest.raises(ValueError, match="threshold"):
            MotionDetector(threshold=0)

    def test_motion_detector_size_mismatch(self) -> None:
        """Frames of different shapes must not crash — return False."""
        detector = MotionDetector()
        frame_a = np.zeros((240, 320, 3), dtype=np.uint8)
        frame_b = np.zeros((480, 640, 3), dtype=np.uint8)
        assert detector.detect(frame_a, frame_b) is False


# ── IntrusionDetector ─────────────────────────────────────────────────────────


class TestIntrusionDetector:
    """
    Zone polygon: unit square [0,0]→[1,0]→[1,1]→[0,1].
    Frame: 100×100 px, so centre = (50,50) → normalised (0.5, 0.5) = inside.
    """

    _UNIT_SQUARE: list[tuple[float, float]] = [
        (0.1, 0.1),
        (0.9, 0.1),
        (0.9, 0.9),
        (0.1, 0.9),
    ]

    def _make_zone(self) -> Zone:
        return Zone(zone_id="z1", camera_id="cam1", polygon=self._UNIT_SQUARE)

    def test_intrusion_detector_inside(self) -> None:
        """Detection centre at (50,50) in a 100×100 frame is inside the zone."""
        zone = self._make_zone()
        detector = IntrusionDetector([zone])

        # bbox centred at (50,50)
        det = Detection(label="person", confidence=0.9, bbox=(40, 40, 60, 60))
        events = detector.check([det], frame_width=100, frame_height=100)

        assert len(events) == 1
        assert events[0].zone_id == "z1"
        assert events[0].camera_id == "cam1"

    def test_intrusion_detector_outside(self) -> None:
        """Detection centre at (5,5) normalised=(0.05,0.05) is outside the zone."""
        zone = self._make_zone()
        detector = IntrusionDetector([zone])

        det = Detection(label="person", confidence=0.9, bbox=(0, 0, 10, 10))
        events = detector.check([det], frame_width=100, frame_height=100)

        assert len(events) == 0

    def test_intrusion_detector_low_confidence_skipped(self) -> None:
        """Detections below 0.6 confidence must not trigger intrusion events."""
        zone = self._make_zone()
        detector = IntrusionDetector([zone])

        det = Detection(label="person", confidence=0.5, bbox=(40, 40, 60, 60))
        events = detector.check([det], frame_width=100, frame_height=100)

        assert len(events) == 0

    def test_intrusion_detector_empty_zones(self) -> None:
        """No zones registered → never any events."""
        detector = IntrusionDetector([])
        det = Detection(label="person", confidence=0.95, bbox=(40, 40, 60, 60))
        events = detector.check([det], frame_width=100, frame_height=100)
        assert len(events) == 0

    def test_intrusion_detector_multiple_zones(self) -> None:
        """A detection inside two zones emits two events."""
        z1 = Zone(zone_id="z1", camera_id="cam1", polygon=self._UNIT_SQUARE)
        z2 = Zone(zone_id="z2", camera_id="cam1", polygon=self._UNIT_SQUARE)
        detector = IntrusionDetector([z1, z2])

        det = Detection(label="person", confidence=0.9, bbox=(40, 40, 60, 60))
        events = detector.check([det], frame_width=100, frame_height=100)

        assert len(events) == 2


# ── YoloDetector (stub) ───────────────────────────────────────────────────────


class TestYoloStub:
    def test_yolo_stub_returns_detections(self) -> None:
        """YoloDetector in stub mode must return at least one Detection."""
        blank_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        detector = YoloDetector()

        detections = detector.detect(blank_frame)

        assert isinstance(detections, list)
        assert len(detections) >= 1

    def test_yolo_stub_detection_structure(self) -> None:
        """Each returned Detection must have label, confidence, and valid bbox."""
        blank_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        detector = YoloDetector()

        for det in detector.detect(blank_frame):
            assert isinstance(det.label, str) and len(det.label) > 0
            assert 0.0 <= det.confidence <= 1.0
            x1, y1, x2, y2 = det.bbox
            assert x2 > x1 and y2 > y1

    def test_yolo_stub_centre_in_frame(self) -> None:
        """Stub places the detection centre inside the frame bounds."""
        h, w = 480, 640
        frame = np.zeros((h, w, 3), dtype=np.uint8)
        detector = YoloDetector()

        for det in detector.detect(frame):
            x1, y1, x2, y2 = det.bbox
            cx = (x1 + x2) // 2
            cy = (y1 + y2) // 2
            assert 0 <= cx < w
            assert 0 <= cy < h
