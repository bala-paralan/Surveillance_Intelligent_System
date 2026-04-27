"""
Seismic waveform classifier.

Uses FFT-based frequency analysis to classify a sample window into one of:
  tunnel | footstep | vehicle | animal | noise

A stub fallback is used when numpy is unavailable (should not happen in
practice since numpy is a hard dependency of the analytics service).
"""
from __future__ import annotations

import logging
import math
from typing import Literal

import numpy as np
from typing_extensions import TypedDict

logger = logging.getLogger(__name__)

# Decay constant for rough distance estimation: dist = k / sqrt(amplitude)
_DECAY_K = 10.0


class SeismicEvent(TypedDict):
    type: Literal["tunnel", "footstep", "vehicle", "animal", "noise"]
    confidence: float
    direction_deg: float  # 0-360; single-sensor approximation
    distance_m: float
    pattern_window_ms: int


class SeismicClassifier:
    """
    Classifies a seismic waveform window based on dominant frequency content.

    Classification rules (peak frequency bands):
      1-4 Hz   → tunnel
      5-12 Hz  → footstep
      20-40 Hz → vehicle
      8-15 Hz  → animal
      else     → noise

    Confidence is the ratio of peak-bin energy to total signal energy.
    Distance is estimated with a simple amplitude-decay model.
    Direction is a ±15° jitter around 0° for a single-sensor deployment
    (true DOA requires a sensor array).
    """

    def classify(self, window: np.ndarray, sample_rate: int) -> SeismicEvent:
        """
        Classify a seismic waveform window.

        Parameters
        ----------
        window:
            1-D float32 array of time-domain samples.
        sample_rate:
            Sample rate in Hz.

        Returns
        -------
        SeismicEvent
        """
        n = len(window)
        pattern_window_ms = int(n * 1000 / max(sample_rate, 1))

        if n == 0:
            return SeismicEvent(
                type="noise",
                confidence=0.0,
                direction_deg=0.0,
                distance_m=float("inf"),
                pattern_window_ms=pattern_window_ms,
            )

        try:
            return self._classify_fft(window, sample_rate, pattern_window_ms)
        except Exception as exc:
            logger.warning("SeismicClassifier FFT failed, returning noise: %s", exc)
            return SeismicEvent(
                type="noise",
                confidence=0.0,
                direction_deg=0.0,
                distance_m=float("inf"),
                pattern_window_ms=pattern_window_ms,
            )

    def _classify_fft(
        self, window: np.ndarray, sample_rate: int, pattern_window_ms: int
    ) -> SeismicEvent:
        n = len(window)

        # FFT — take one-sided spectrum
        fft_vals = np.fft.rfft(window)
        power = np.abs(fft_vals) ** 2
        freqs = np.fft.rfftfreq(n, d=1.0 / sample_rate)

        total_energy = float(np.sum(power))
        if total_energy == 0.0:
            peak_idx = 0
            confidence = 0.0
        else:
            peak_idx = int(np.argmax(power))
            confidence = float(power[peak_idx] / total_energy)

        peak_freq = float(freqs[peak_idx]) if len(freqs) > 0 else 0.0

        # Classify by peak frequency band
        event_type: Literal["tunnel", "footstep", "vehicle", "animal", "noise"]
        if 1.0 <= peak_freq <= 4.0:
            event_type = "tunnel"
        elif 5.0 <= peak_freq <= 12.0:
            event_type = "footstep"
        elif 20.0 <= peak_freq <= 40.0:
            event_type = "vehicle"
        elif 8.0 <= peak_freq <= 15.0:
            event_type = "animal"
        else:
            event_type = "noise"

        # Rough distance estimate from RMS amplitude (mag decay model)
        rms_amplitude = float(np.sqrt(np.mean(window ** 2)))
        if rms_amplitude > 1e-9:
            distance_m = _DECAY_K / math.sqrt(rms_amplitude)
        else:
            distance_m = float("inf")

        # Single-sensor direction: pseudo-random ±15° around 0°
        rng = np.random.default_rng(seed=int(abs(peak_freq * 100)) % (2**31))
        direction_deg = float(rng.uniform(-15.0, 15.0)) % 360.0

        # Only log event type + sensor context — never log direction or distance
        logger.debug("SeismicClassifier: event_type=%s confidence=%.3f", event_type, confidence)

        return SeismicEvent(
            type=event_type,
            confidence=min(confidence, 1.0),
            direction_deg=round(direction_deg, 2),
            distance_m=round(distance_m, 2),
            pattern_window_ms=pattern_window_ms,
        )
