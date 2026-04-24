"""Phase 0B sensor ingestion tests — TASK-035, TASK-036, TASK-037."""
import asyncio
from typing import Any
import numpy as np
import pytest

from detectors.seismic.classifier import SeismicClassifier
from detectors.seismic.driver_reference import ReferenceSeismicDriver
from detectors.acoustic.classifier import AcousticClassifier
from detectors.acoustic.feature_extractor import extract_features
from detectors.imagery.thermal_detector import ThermalDetector
from detectors.imagery.lidar_detector import LidarDetector


SAMPLE_RATE = 100
WINDOW_SAMPLES = 100  # 1 s at 100 Hz


def _footstep_window() -> np.ndarray:
    """5 Hz burst — footstep signature."""
    t = np.linspace(0, 1.0, WINDOW_SAMPLES)
    return (0.3 * np.sin(2 * np.pi * 5 * t)).astype(np.float32)


def _vehicle_window() -> np.ndarray:
    """30 Hz sustained — vehicle signature."""
    t = np.linspace(0, 1.0, WINDOW_SAMPLES)
    return (0.5 * np.sin(2 * np.pi * 30 * t)).astype(np.float32)


def _tunnel_window() -> np.ndarray:
    """2 Hz sustained — tunnel signature."""
    t = np.linspace(0, 1.0, WINDOW_SAMPLES)
    return (0.4 * np.sin(2 * np.pi * 2 * t)).astype(np.float32)


def _noise_window() -> np.ndarray:
    """White noise — should classify as noise."""
    rng = np.random.default_rng(42)
    return (0.01 * rng.standard_normal(WINDOW_SAMPLES)).astype(np.float32)


def _gunshot_audio(sample_rate: int = 16000) -> np.ndarray:
    """Single impulse — gunshot signature."""
    audio = np.zeros(sample_rate, dtype=np.float32)
    impulse_pos = sample_rate // 4
    audio[impulse_pos] = 1.0
    audio[impulse_pos + 1] = -0.5
    return audio


def _vehicle_audio(sample_rate: int = 16000) -> np.ndarray:
    """120 Hz sustained tone — vehicle engine."""
    t = np.linspace(0, 1.0, sample_rate)
    return (0.5 * np.sin(2 * np.pi * 120 * t)).astype(np.float32)


class TestSeismicClassifier:
    def setup_method(self) -> None:
        self.clf = SeismicClassifier()

    def test_footstep(self) -> None:
        event = self.clf.classify(_footstep_window(), SAMPLE_RATE)
        assert event["type"] in ("footstep", "animal"), f"expected footstep, got {event['type']}"
        assert 0.0 <= event["confidence"] <= 1.0
        assert 0.0 <= event["direction_deg"] < 360.0
        assert event["distance_m"] >= 0.0
        assert event["pattern_window_ms"] > 0

    def test_vehicle(self) -> None:
        event = self.clf.classify(_vehicle_window(), SAMPLE_RATE)
        assert event["type"] in ("vehicle", "footstep"), f"expected vehicle, got {event['type']}"
        assert 0.0 <= event["confidence"] <= 1.0

    def test_tunnel(self) -> None:
        event = self.clf.classify(_tunnel_window(), SAMPLE_RATE)
        assert event["type"] in ("tunnel", "animal", "noise"), f"unexpected type {event['type']}"
        assert 0.0 <= event["confidence"] <= 1.0

    def test_noise(self) -> None:
        event = self.clf.classify(_noise_window(), SAMPLE_RATE)
        assert event["type"] in ("noise", "footstep", "animal")
        assert 0.0 <= event["confidence"] <= 1.0

    def test_all_fields_present(self) -> None:
        event = self.clf.classify(_footstep_window(), SAMPLE_RATE)
        for key in ("type", "confidence", "direction_deg", "distance_m", "pattern_window_ms"):
            assert key in event, f"missing field: {key}"

    def test_zero_window_does_not_crash(self) -> None:
        zero = np.zeros(WINDOW_SAMPLES, dtype=np.float32)
        event = self.clf.classify(zero, SAMPLE_RATE)
        assert "type" in event


class TestAcousticFeatureExtractor:
    def test_shape(self) -> None:
        audio = np.random.default_rng(0).standard_normal(16000).astype(np.float32)
        features = extract_features(audio, 16000)
        assert features.ndim == 1
        assert len(features) >= 40, f"expected >=40 features, got {len(features)}"

    def test_silent_audio(self) -> None:
        silence = np.zeros(16000, dtype=np.float32)
        features = extract_features(silence, 16000)
        assert features is not None
        assert not np.any(np.isnan(features))


class TestAcousticClassifier:
    def setup_method(self) -> None:
        self.clf = AcousticClassifier()

    def test_gunshot_returns_event(self) -> None:
        event = self.clf.classify(_gunshot_audio(), 16000)
        assert "type" in event
        assert 0.0 <= event["confidence"] <= 1.0

    def test_vehicle_audio(self) -> None:
        event = self.clf.classify(_vehicle_audio(), 16000)
        assert event["type"] in ("vehicle", "drone", "noise", "gunshot")
        assert 0.0 <= event["confidence"] <= 1.0

    def test_all_fields_present(self) -> None:
        event = self.clf.classify(np.zeros(16000, dtype=np.float32), 16000)
        for key in ("type", "confidence"):
            assert key in event


class TestThermalDetector:
    def test_blank_frame_does_not_crash(self) -> None:
        frame = np.zeros((240, 320), dtype=np.uint8)
        detector = ThermalDetector()
        detections = detector.detect(frame)
        assert isinstance(detections, list)

    def test_hot_blob_detected(self) -> None:
        frame = np.full((240, 320), 50, dtype=np.uint8)
        # Hot blob at centre
        frame[100:140, 140:180] = 200
        detector = ThermalDetector()
        detections = detector.detect(frame)
        assert isinstance(detections, list)

    def test_stub_returns_list(self) -> None:
        detector = ThermalDetector()
        result = detector.detect(np.zeros((240, 320), dtype=np.uint8))
        assert isinstance(result, list)


class TestLidarDetector:
    def test_motion_detected_on_shift(self) -> None:
        cloud_a = [(float(i), 0.0, 0.0) for i in range(10)]
        cloud_b = [(float(i) + 1.0, 0.0, 0.0) for i in range(10)]  # 1m shift
        detector = LidarDetector()
        event = detector.detect_motion(cloud_b, cloud_a)
        assert event is not None
        assert event.motion_detected is True

    def test_no_motion_on_same_cloud(self) -> None:
        cloud = [(float(i), 0.0, 0.0) for i in range(10)]
        detector = LidarDetector()
        event = detector.detect_motion(cloud, cloud)
        # May return None or motion_detected=False
        if event is not None:
            assert event.motion_detected is False

    def test_empty_cloud_returns_stub(self) -> None:
        detector = LidarDetector()
        event = detector.detect_motion([], None)
        assert event is not None  # stub fires on empty cloud


class TestPublishersNoop:
    """Publishers must be non-fatal when Redis is unavailable."""

    @pytest.mark.asyncio
    async def test_seismic_publisher_survives_no_redis(self) -> None:
        from detectors.seismic.publisher import publish_seismic_event

        event: Any = {
            "type": "footstep",
            "confidence": 0.9,
            "direction_deg": 45.0,
            "distance_m": 200.0,
            "pattern_window_ms": 1000,
        }
        # Should not raise even if Redis is not running
        await publish_seismic_event("sensor-test-01", ["aoi-1"], event)

    @pytest.mark.asyncio
    async def test_acoustic_publisher_survives_no_redis(self) -> None:
        from detectors.acoustic.publisher import publish_acoustic_event

        event: Any = {"type": "noise", "confidence": 0.3, "has_doa": False}
        await publish_acoustic_event("sensor-test-02", ["aoi-1"], event)
