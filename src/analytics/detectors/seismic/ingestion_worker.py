"""
Seismic ingestion worker.

Continuously reads windows from a SeismicDriver, classifies them with
SeismicClassifier, and publishes results to Redis.
"""
from __future__ import annotations

import asyncio
import logging

from analytics.detectors.seismic.classifier import SeismicClassifier
from analytics.detectors.seismic.driver import SeismicDriver
from analytics.detectors.seismic.publisher import publish_seismic_event

logger = logging.getLogger(__name__)


class SeismicIngestionWorker:
    """
    Continuously ingests seismic windows from a driver and publishes events.

    Parameters
    ----------
    driver:
        Concrete SeismicDriver implementation.
    classifier:
        SeismicClassifier instance.
    aoi_ids:
        Area-of-Interest IDs to include in published events.
    """

    def __init__(
        self,
        driver: SeismicDriver,
        classifier: SeismicClassifier,
        aoi_ids: list[str] | None = None,
    ) -> None:
        self._driver = driver
        self._classifier = classifier
        self._aoi_ids: list[str] = aoi_ids if aoi_ids is not None else []

    async def run(self, window_ms: int = 1000) -> None:
        """
        Run the ingestion loop indefinitely.

        Each iteration:
          1. Read a window from the driver.
          2. Classify the window.
          3. Publish the event to Redis.
          4. Sleep for ``window_ms`` milliseconds before the next window.

        Parameters
        ----------
        window_ms:
            Duration of each analysis window in milliseconds.
        """
        logger.info(
            "SeismicIngestionWorker starting: sensor_id=%s window_ms=%d",
            self._driver.sensor_id,
            window_ms,
        )
        while True:
            try:
                window = await self._driver.read_window(window_ms)
                event = self._classifier.classify(window, self._driver.sample_rate_hz)
                await publish_seismic_event(self._driver.sensor_id, self._aoi_ids, event)
            except Exception as exc:
                logger.error(
                    "SeismicIngestionWorker error for sensor_id=%s: %s",
                    self._driver.sensor_id,
                    exc,
                )
            await asyncio.sleep(window_ms / 1000.0)
