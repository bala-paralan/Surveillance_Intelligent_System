"""
Abstract base class for seismic sensor drivers.

All concrete drivers must subclass SeismicDriver and implement the three
abstract coroutines plus the two properties.
"""
from __future__ import annotations

import abc

import numpy as np


class SeismicDriver(abc.ABC):
    """Abstract interface for a seismic sensor driver."""

    @abc.abstractmethod
    async def start(self) -> None:
        """Begin reading samples from the sensor."""

    @abc.abstractmethod
    async def stop(self) -> None:
        """Stop reading samples and release any resources."""

    @abc.abstractmethod
    async def read_window(self, window_ms: int = 1000) -> np.ndarray:
        """
        Return a window of float32 samples.

        Parameters
        ----------
        window_ms:
            Duration of the window in milliseconds.

        Returns
        -------
        np.ndarray
            1-D float32 array of length ``sample_rate_hz * window_ms / 1000``.
        """

    @property
    @abc.abstractmethod
    def sensor_id(self) -> str:
        """Unique identifier for this sensor instance."""

    @property
    @abc.abstractmethod
    def sample_rate_hz(self) -> int:
        """Nominal sample rate of the sensor in Hz."""
