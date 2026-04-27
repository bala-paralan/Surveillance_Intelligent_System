"""
Reference (synthetic) acoustic driver for testing and simulation.

Reads the desired scenario from the environment variable ``ACOUSTIC_SCENARIO``
(default: ``NORMAL``).  Generates synthetic audio for each scenario WITHOUT
any intelligible speech or real audio content.

PRIVACY NOTE: The VOICE scenario generates a band-limited signal that
simulates the spectral envelope of speech.  It does NOT capture, reproduce,
or transcribe any real human speech.
"""
from __future__ import annotations

import logging
import os

import numpy as np

from analytics.detectors.acoustic.driver import AcousticDriver

logger = logging.getLogger(__name__)

_VALID_SCENARIOS = frozenset({"NORMAL", "VOICE", "GUNSHOT", "VEHICLE", "DRONE", "ANIMAL"})
_DEFAULT_SAMPLE_RATE = 16000


class ReferenceAcousticDriver(AcousticDriver):
    """
    Simulates an acoustic sensor by generating synthetic audio.

    Scenarios (controlled via ``ACOUSTIC_SCENARIO`` env var):
      - NORMAL  : white noise baseline
      - VOICE   : 300-3400 Hz band-limited signal (simulated speech envelope only)
      - GUNSHOT : single high-energy impulse burst
      - VEHICLE : 80-200 Hz engine harmonics
      - DRONE   : 150-300 Hz rotor + harmonics
      - ANIMAL  : irregular frequency chirps

    Parameters
    ----------
    sensor_id:
        Unique identifier for this driver instance.
    """

    def __init__(self, sensor_id: str) -> None:
        self._sensor_id = sensor_id
        self._sample_rate_hz = _DEFAULT_SAMPLE_RATE

        raw_scenario = os.getenv("ACOUSTIC_SCENARIO", "NORMAL").upper()
        if raw_scenario not in _VALID_SCENARIOS:
            logger.warning(
                "Unknown ACOUSTIC_SCENARIO '%s' — falling back to NORMAL", raw_scenario
            )
            raw_scenario = "NORMAL"
        self._scenario = raw_scenario
        logger.info("ReferenceAcousticDriver sensor_id=%s scenario=%s", sensor_id, self._scenario)

    # ── AcousticDriver interface ──────────────────────────────────────────────

    async def start(self) -> None:
        logger.info("ReferenceAcousticDriver started (scenario=%s)", self._scenario)

    async def stop(self) -> None:
        logger.info("ReferenceAcousticDriver stopped")

    async def read_frame(self, duration_s: float = 1.0) -> np.ndarray:
        """Generate synthetic audio matching the configured scenario."""
        n_samples = int(self._sample_rate_hz * duration_s)
        t = np.linspace(0.0, duration_s, n_samples, endpoint=False)
        rng = np.random.default_rng()

        if self._scenario == "NORMAL":
            samples = rng.normal(0.0, 0.02, n_samples).astype(np.float32)

        elif self._scenario == "VOICE":
            # Band-limited 300-3400 Hz simulated speech envelope — NOT intelligible
            noise = rng.normal(0.0, 1.0, n_samples)
            fft_vals = np.fft.rfft(noise)
            freqs = np.fft.rfftfreq(n_samples, d=1.0 / self._sample_rate_hz)
            band_mask = (freqs >= 300.0) & (freqs <= 3400.0)
            fft_vals[~band_mask] = 0.0
            band_signal = np.fft.irfft(fft_vals, n=n_samples)
            # Apply slow amplitude envelope to simulate utterance rhythm
            envelope = 0.5 + 0.5 * np.sin(2 * np.pi * 3.0 * t)
            samples = (band_signal * envelope * 0.3).astype(np.float32)

        elif self._scenario == "GUNSHOT":
            samples = rng.normal(0.0, 0.005, n_samples).astype(np.float32)
            # Single short high-energy impulse
            impulse_start = int(n_samples * 0.1)
            impulse_end = impulse_start + max(int(0.005 * self._sample_rate_hz), 1)
            impulse_end = min(impulse_end, n_samples)
            impulse = rng.normal(0.0, 1.0, impulse_end - impulse_start) * 2.0
            samples[impulse_start:impulse_end] = impulse.astype(np.float32)

        elif self._scenario == "VEHICLE":
            base_freq = rng.uniform(80.0, 140.0)
            noise = rng.normal(0.0, 0.01, n_samples)
            harmonics = np.zeros(n_samples)
            for k in range(1, 4):
                freq_k = base_freq * k
                if freq_k <= 200.0:
                    harmonics += (0.3 / k) * np.sin(2 * np.pi * freq_k * t)
            samples = (harmonics + noise).astype(np.float32)

        elif self._scenario == "DRONE":
            rotor_freq = rng.uniform(150.0, 250.0)
            noise = rng.normal(0.0, 0.01, n_samples)
            signal = np.zeros(n_samples)
            for k in range(1, 5):
                freq_k = rotor_freq * k
                if freq_k <= 300.0:
                    signal += (0.4 / k) * np.sin(2 * np.pi * freq_k * t)
            samples = (signal + noise).astype(np.float32)

        elif self._scenario == "ANIMAL":
            samples = rng.normal(0.0, 0.01, n_samples).astype(np.float32)
            n_chirps = rng.integers(2, 6)
            for _ in range(n_chirps):
                chirp_start = rng.uniform(0.0, max(duration_s - 0.1, 0.01))
                chirp_freq = rng.uniform(800.0, 4000.0)
                chirp_width = rng.uniform(0.02, 0.08)
                mask = (t >= chirp_start) & (t < chirp_start + chirp_width)
                samples[mask] += (0.4 * np.sin(2 * np.pi * chirp_freq * t[mask])).astype(np.float32)

        else:  # fallback
            samples = rng.normal(0.0, 0.02, n_samples).astype(np.float32)

        return samples

    # ── Properties ────────────────────────────────────────────────────────────

    @property
    def sensor_id(self) -> str:
        return self._sensor_id

    @property
    def sample_rate_hz(self) -> int:
        return self._sample_rate_hz
