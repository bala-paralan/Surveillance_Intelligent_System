"""
Abstract base class for acoustic sensor drivers.
"""
from __future__ import annotations

import abc

import numpy as np


class AcousticDriver(abc.ABC):
    """Abstract interface for an acoustic (microphone/hydrophone) sensor driver."""

    @abc.abstractmethod
    async def start(self) -> None:
        """Begin capturing audio from the sensor."""

    @abc.abstractmethod
    async def stop(self) -> None:
        """Stop capturing audio and release any resources."""

    @abc.abstractmethod
    async def read_frame(self, duration_s: float = 1.0) -> np.ndarray:
        """
        Return a frame of float32 audio samples.

        Parameters
        ----------
        duration_s:
            Duration of the audio frame in seconds.

        Returns
        -------
        np.ndarray
            1-D float32 array of length ``sample_rate_hz * duration_s``.
        """

    @property
    @abc.abstractmethod
    def sensor_id(self) -> str:
        """Unique identifier for this sensor instance."""

    @property
    @abc.abstractmethod
    def sample_rate_hz(self) -> int:
        """Nominal sample rate of the sensor in Hz."""
