"""
Acoustic event classifier.

Uses spectral features (spectral centroid, zero-crossing rate, energy, dominant
frequency band) to classify audio into event types.

PRIVACY: Never attempts speech transcription or speaker identification.
Output is class label only.
"""
from __future__ import annotations

import logging
from typing import Literal

import numpy as np
from typing_extensions import TypedDict

from analytics.detectors.acoustic.feature_extractor import extract_features

logger = logging.getLogger(__name__)


class AcousticEvent(TypedDict):
    type: Literal["gunshot", "vehicle", "drone", "voice", "animal", "noise"]
    confidence: float
    direction_deg: float  # optional DOA estimate; 0.0 when has_doa=False
    has_doa: bool


class AcousticClassifier:
    """
    Rule-based acoustic event classifier.

    Classification is based on:
      - Zero-crossing rate (ZCR): high ZCR + single impulse → gunshot
      - Dominant frequency band (via FFT):
          80-200 Hz sustained  → vehicle
          150-300 Hz sustained → drone
          300-3400 Hz natural  → voice
          irregular chirps     → animal
          else                 → noise
      - Confidence: spectral separation ratio

    PRIVACY NOTE: The classifier outputs class labels only. Speech
    transcription is explicitly prohibited by design.
    """

    def classify(self, audio: np.ndarray, sample_rate: int) -> AcousticEvent:
        """
        Classify an audio frame.

        Parameters
        ----------
        audio:
            1-D float32 array of audio samples.
        sample_rate:
            Sample rate of the audio in Hz.

        Returns
        -------
        AcousticEvent
        """
        if len(audio) == 0:
            return AcousticEvent(
                type="noise",
                confidence=0.0,
                direction_deg=0.0,
                has_doa=False,
            )

        try:
            return self._classify_rule_based(audio, sample_rate)
        except Exception as exc:
            logger.warning("AcousticClassifier failed, returning noise: %s", exc)
            return AcousticEvent(
                type="noise",
                confidence=0.0,
                direction_deg=0.0,
                has_doa=False,
            )

    def _classify_rule_based(
        self, audio: np.ndarray, sample_rate: int
    ) -> AcousticEvent:
        # Extract features (for logging/future ML use) — suppress raw feature values
        _ = extract_features(audio, sample_rate)

        n = len(audio)
        fft_vals = np.fft.rfft(audio)
        power = np.abs(fft_vals) ** 2
        freqs = np.fft.rfftfreq(n, d=1.0 / sample_rate)
        total_power = float(np.sum(power))

        # Zero-crossing rate
        zcr = float(np.mean(np.abs(np.diff(np.sign(audio)))) / 2.0)

        # RMS energy
        rms = float(np.sqrt(np.mean(audio ** 2)))

        # Peak frequency
        peak_idx = int(np.argmax(power)) if total_power > 0 else 0
        peak_freq = float(freqs[peak_idx]) if len(freqs) > 0 else 0.0
        peak_power = float(power[peak_idx]) if total_power > 0 else 0.0

        # Spectral centroid
        if total_power > 0:
            spectral_centroid = float(np.sum(freqs * power) / total_power)
        else:
            spectral_centroid = 0.0

        # Confidence from spectral separation ratio
        confidence = min(peak_power / (total_power + 1e-10), 1.0)

        # Impulse detection: single short high-energy burst with high ZCR
        n_fft_half = n // 2
        first_half_energy = float(np.sum(audio[:n_fft_half] ** 2))
        second_half_energy = float(np.sum(audio[n_fft_half:] ** 2))
        total_energy = first_half_energy + second_half_energy + 1e-10
        energy_imbalance = abs(first_half_energy - second_half_energy) / total_energy

        event_type: Literal["gunshot", "vehicle", "drone", "voice", "animal", "noise"]

        # Gunshot: high ZCR + concentrated energy (impulse) + high RMS
        if zcr > 0.3 and energy_imbalance > 0.4 and rms > 0.1:
            event_type = "gunshot"
            confidence = min(zcr * energy_imbalance, 1.0)

        # Vehicle: dominant 80-200 Hz sustained
        elif 80.0 <= spectral_centroid <= 200.0 and zcr < 0.15:
            event_type = "vehicle"

        # Drone: dominant 150-300 Hz
        elif 150.0 <= spectral_centroid <= 300.0 and zcr < 0.2:
            event_type = "drone"

        # Voice: 300-3400 Hz band with natural envelope
        elif 300.0 <= spectral_centroid <= 3400.0 and 0.05 <= zcr <= 0.35:
            event_type = "voice"
            # PRIVACY: only output label, never transcribe content
            logger.debug("AcousticClassifier: voice event detected (no transcription)")

        # Animal: irregular chirps — high ZCR but not impulse
        elif zcr > 0.25 and energy_imbalance < 0.3 and peak_freq > 300.0:
            event_type = "animal"

        else:
            event_type = "noise"

        # Only log event type + sensor context — never log audio features
        logger.debug("AcousticClassifier: event_type=%s confidence=%.3f", event_type, confidence)

        return AcousticEvent(
            type=event_type,
            confidence=round(float(confidence), 4),
            direction_deg=0.0,  # single-sensor: no DOA
            has_doa=False,
        )
