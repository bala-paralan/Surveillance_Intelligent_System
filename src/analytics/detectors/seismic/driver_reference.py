"""
Reference (synthetic) seismic driver for testing and simulation.

Reads the desired scenario from the environment variable ``SEISMIC_SCENARIO``
(default: ``NORMAL``).  Generates plausible synthetic waveforms for each
scenario without touching real hardware.
"""
from __future__ import annotations

import logging
import os

import numpy as np

from analytics.detectors.seismic.driver import SeismicDriver

logger = logging.getLogger(__name__)

_VALID_SCENARIOS = frozenset({"NORMAL", "FOOTSTEP", "VEHICLE", "TUNNEL", "ANIMAL"})


class ReferenceSeismicDriver(SeismicDriver):
    """
    Simulates a seismic sensor by generating synthetic waveforms.

    Scenarios (controlled via ``SEISMIC_SCENARIO`` env var):
      - NORMAL   : low-amplitude Gaussian noise baseline
      - FOOTSTEP : 5-12 Hz bursts every 0.5-1 s
      - VEHICLE  : 20-40 Hz sustained vibration
      - TUNNEL   : 1-4 Hz sustained with harmonics
      - ANIMAL   : irregular 8-15 Hz bursts

    Parameters
    ----------
    sensor_id:
        Unique identifier for this driver instance.
    sample_rate_hz:
        Nominal sample rate in Hz (default 100).
    """

    def __init__(self, sensor_id: str, sample_rate_hz: int = 100) -> None:
        self._sensor_id = sensor_id
        self._sample_rate_hz = sample_rate_hz

        raw_scenario = os.getenv("SEISMIC_SCENARIO", "NORMAL").upper()
        if raw_scenario not in _VALID_SCENARIOS:
            logger.warning(
                "Unknown SEISMIC_SCENARIO '%s' — falling back to NORMAL", raw_scenario
            )
            raw_scenario = "NORMAL"
        self._scenario = raw_scenario
        logger.info("ReferenceSeismicDriver sensor_id=%s scenario=%s", sensor_id, self._scenario)

    # ── SeismicDriver interface ───────────────────────────────────────────────

    async def start(self) -> None:
        logger.info("ReferenceSeismicDriver started (scenario=%s)", self._scenario)

    async def stop(self) -> None:
        logger.info("ReferenceSeismicDriver stopped")

    async def read_window(self, window_ms: int = 1000) -> np.ndarray:
        """Generate a synthetic waveform window matching the configured scenario."""
        n_samples = int(self._sample_rate_hz * window_ms / 1000)
        t = np.linspace(0.0, window_ms / 1000.0, n_samples, endpoint=False)
        rng = np.random.default_rng()

        if self._scenario == "NORMAL":
            samples = rng.normal(0.0, 0.01, n_samples).astype(np.float32)

        elif self._scenario == "FOOTSTEP":
            samples = rng.normal(0.0, 0.005, n_samples).astype(np.float32)
            # Inject 5-12 Hz bursts at random positions (every 0.5-1 s)
            burst_freq = rng.uniform(5.0, 12.0)
            burst_interval_s = rng.uniform(0.5, 1.0)
            burst_width_s = 0.05
            burst_start = 0.0
            while burst_start < window_ms / 1000.0:
                mask = (t >= burst_start) & (t < burst_start + burst_width_s)
                samples[mask] += (0.5 * np.sin(2 * np.pi * burst_freq * t[mask])).astype(np.float32)
                burst_start += burst_interval_s

        elif self._scenario == "VEHICLE":
            freq = rng.uniform(20.0, 40.0)
            amplitude = rng.uniform(0.3, 0.8)
            noise = rng.normal(0.0, 0.02, n_samples)
            samples = (amplitude * np.sin(2 * np.pi * freq * t) + noise).astype(np.float32)

        elif self._scenario == "TUNNEL":
            base_freq = rng.uniform(1.0, 4.0)
            noise = rng.normal(0.0, 0.01, n_samples)
            harmonics = np.zeros(n_samples)
            for k in range(1, 5):
                harmonics += (0.4 / k) * np.sin(2 * np.pi * base_freq * k * t)
            samples = (harmonics + noise).astype(np.float32)

        elif self._scenario == "ANIMAL":
            samples = rng.normal(0.0, 0.005, n_samples).astype(np.float32)
            # Irregular 8-15 Hz chirps
            n_chirps = rng.integers(3, 8)
            for _ in range(n_chirps):
                chirp_start = rng.uniform(0.0, max(window_ms / 1000.0 - 0.1, 0.01))
                chirp_freq = rng.uniform(8.0, 15.0)
                chirp_width = rng.uniform(0.03, 0.08)
                mask = (t >= chirp_start) & (t < chirp_start + chirp_width)
                samples[mask] += (0.3 * np.sin(2 * np.pi * chirp_freq * t[mask])).astype(np.float32)

        else:  # fallback — should not reach here
            samples = rng.normal(0.0, 0.01, n_samples).astype(np.float32)

        return samples

    # ── Properties ────────────────────────────────────────────────────────────

    @property
    def sensor_id(self) -> str:
        return self._sensor_id

    @property
    def sample_rate_hz(self) -> int:
        return self._sample_rate_hz
