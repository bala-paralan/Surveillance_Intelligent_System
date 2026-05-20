"""
Zone-based intrusion detector.

For each detection whose centre falls inside a registered zone polygon,
an IntrusionEvent is emitted.  Polygon membership is tested with a
standard ray-casting algorithm operating on normalised [0, 1] coordinates.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from analytics.models.yolo_wrapper import Detection


@dataclass
class Zone:
    """A named polygon region within a camera's field of view."""

    zone_id: str
    camera_id: str
    # Vertices in normalised [0, 1] coordinate space: (x, y)
    polygon: list[tuple[float, float]] = field(default_factory=list)


@dataclass
class IntrusionEvent:
    """Fired when a detection's centre enters a zone polygon."""

    zone_id: str
    camera_id: str
    detection: Detection
    confidence: float


# ── helpers ───────────────────────────────────────────────────────────────────


def _point_in_polygon(px: float, py: float, polygon: list[tuple[float, float]]) -> bool:
    """
    Ray-casting algorithm for point-in-polygon test.

    Returns True when the point (px, py) lies inside the polygon.
    Edge cases (point exactly on edge or vertex) are treated as inside.
    """
    n = len(polygon)
    if n < 3:
        return False

    inside = False
    j = n - 1

    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]

        # Check if the horizontal ray from (px, py) crosses edge (j→i)
        if (yi > py) != (yj > py) and px < (xj - xi) * (py - yi) / (yj - yi + 1e-12) + xi:
            inside = not inside

        j = i

    return inside


# ── detector ─────────────────────────────────────────────────────────────────


class IntrusionDetector:
    """
    Checks whether any detection centre falls inside a registered zone.

    Parameters
    ----------
    zones:
        List of Zone objects that define the restricted areas.
    """

    def __init__(self, zones: list[Zone]) -> None:
        self._zones = zones

    def check(
        self,
        detections: list[Detection],
        frame_width: int,
        frame_height: int,
    ) -> list[IntrusionEvent]:
        """
        Return IntrusionEvent objects for every detection/zone pair where:
        - detection.confidence >= 0.6
        - the detection's normalised centre is inside the zone polygon.

        Parameters
        ----------
        detections:
            Detection objects from YoloDetector.detect().
        frame_width:
            Width of the source frame in pixels (used for normalisation).
        frame_height:
            Height of the source frame in pixels (used for normalisation).
        """
        if frame_width <= 0 or frame_height <= 0:
            return []

        events: list[IntrusionEvent] = []

        for det in detections:
            if det.confidence < 0.6:
                continue

            x1, y1, x2, y2 = det.bbox
            cx = ((x1 + x2) / 2.0) / frame_width
            cy = ((y1 + y2) / 2.0) / frame_height

            for zone in self._zones:
                if _point_in_polygon(cx, cy, zone.polygon):
                    events.append(
                        IntrusionEvent(
                            zone_id=zone.zone_id,
                            camera_id=zone.camera_id,
                            detection=det,
                            confidence=det.confidence,
                        )
                    )

        return events
