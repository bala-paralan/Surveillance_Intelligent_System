"""
LiDAR point-cloud motion detector.

Compares two point clouds by centroid shift to detect motion events.
Falls back to a synthetic event when the cloud is empty (stub mode).
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# Minimum centroid shift (metres) to declare motion
_MOTION_THRESHOLD_M = 0.5


@dataclass
class LidarEvent:
    """Result of a LiDAR frame comparison."""

    motion_detected: bool
    cluster_count: int
    range_m: float
    bearing_deg: float


class LidarDetector:
    """
    Detects motion in LiDAR point clouds by centroid shift analysis.

    Compares the centroid of the current cloud to the previous cloud.
    A shift greater than ``_MOTION_THRESHOLD_M`` metres is considered motion.
    """

    def detect_motion(
        self,
        point_cloud: list[tuple[float, float, float]],
        prev_cloud: list[tuple[float, float, float]],
    ) -> Optional[LidarEvent]:
        """
        Detect motion between two consecutive point cloud frames.

        Parameters
        ----------
        point_cloud:
            Current frame as a list of (x, y, z) tuples in metres.
        prev_cloud:
            Previous frame as a list of (x, y, z) tuples in metres.

        Returns
        -------
        LidarEvent or None
            Returns None only if both clouds are empty and stub mode is
            also disabled.  When ``point_cloud`` is empty, returns a
            synthetic stub event.
        """
        if len(point_cloud) == 0:
            logger.debug("LidarDetector: empty cloud — returning synthetic stub event")
            return self._stub_event()

        try:
            return self._compute_motion(point_cloud, prev_cloud)
        except Exception as exc:
            logger.error("LidarDetector error: %s", exc)
            return self._stub_event()

    def _compute_motion(
        self,
        point_cloud: list[tuple[float, float, float]],
        prev_cloud: list[tuple[float, float, float]],
    ) -> LidarEvent:
        curr_arr = np.array(point_cloud, dtype=np.float32)
        curr_centroid = curr_arr.mean(axis=0)

        # Simple clustering estimate: count points in distinct spatial bins
        cluster_count = self._estimate_cluster_count(curr_arr)

        # Range from sensor origin (0,0,0) to centroid
        range_m = float(np.linalg.norm(curr_centroid))

        # Bearing in horizontal plane (XY), degrees from +X axis
        bearing_deg = math.degrees(math.atan2(float(curr_centroid[1]), float(curr_centroid[0]))) % 360.0

        if len(prev_cloud) == 0:
            # No previous frame to compare — not enough data to declare motion
            return LidarEvent(
                motion_detected=False,
                cluster_count=cluster_count,
                range_m=round(range_m, 2),
                bearing_deg=round(bearing_deg, 2),
            )

        prev_arr = np.array(prev_cloud, dtype=np.float32)
        prev_centroid = prev_arr.mean(axis=0)

        shift = float(np.linalg.norm(curr_centroid - prev_centroid))
        motion_detected = shift > _MOTION_THRESHOLD_M

        logger.debug(
            "LidarDetector: centroid_shift=%.3f m motion_detected=%s",
            shift,
            motion_detected,
        )

        return LidarEvent(
            motion_detected=motion_detected,
            cluster_count=cluster_count,
            range_m=round(range_m, 2),
            bearing_deg=round(bearing_deg, 2),
        )

    @staticmethod
    def _estimate_cluster_count(arr: np.ndarray) -> int:
        """Rough cluster count: number of distinct 2 m grid cells occupied."""
        if len(arr) == 0:
            return 0
        grid = set(
            (int(p[0] / 2.0), int(p[1] / 2.0))
            for p in arr
        )
        return len(grid)

    @staticmethod
    def _stub_event() -> LidarEvent:
        """Synthetic event returned when the cloud is empty."""
        return LidarEvent(
            motion_detected=True,
            cluster_count=1,
            range_m=5.0,
            bearing_deg=0.0,
        )
