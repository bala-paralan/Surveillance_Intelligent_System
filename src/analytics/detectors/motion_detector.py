"""
Motion detector using frame differencing (cv2.absdiff).

A motion event is raised when at least one contour in the difference image
has an area exceeding `min_area` pixels after thresholding.
"""
from __future__ import annotations

import cv2
import numpy as np


class MotionDetector:
    """
    Detects motion between consecutive video frames.

    Parameters
    ----------
    threshold:
        Per-pixel absolute difference threshold (0-255) used to create a
        binary mask.  Higher values ignore subtle illumination changes.
    min_area:
        Minimum contour area (pixels²) that counts as real motion.
        Filters out sensor noise and tiny artefacts.
    """

    def __init__(self, threshold: int = 25, min_area: int = 500) -> None:
        if not (0 < threshold <= 255):
            raise ValueError("threshold must be in range (0, 255]")
        if min_area < 0:
            raise ValueError("min_area must be non-negative")

        self._threshold = threshold
        self._min_area = min_area

    def detect(
        self,
        frame: np.ndarray,
        prev_frame: np.ndarray | None,
    ) -> bool:
        """
        Return True if significant motion is detected between *prev_frame* and
        *frame*.  Returns False when *prev_frame* is None (no baseline yet).

        Parameters
        ----------
        frame:
            Current BGR or grayscale frame as a NumPy array.
        prev_frame:
            Previous frame in the same colour space and size.  Pass None on
            the very first call.
        """
        if prev_frame is None:
            return False

        # Convert to grayscale if necessary
        def to_gray(img: np.ndarray) -> np.ndarray:
            if img.ndim == 3 and img.shape[2] == 3:
                return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            return img

        gray_curr = to_gray(frame)
        gray_prev = to_gray(prev_frame)

        # Ensure same size; skip if incompatible
        if gray_curr.shape != gray_prev.shape:
            return False

        diff = cv2.absdiff(gray_curr, gray_prev)
        _, mask = cv2.threshold(diff, self._threshold, 255, cv2.THRESH_BINARY)

        # Morphological opening to remove speckle noise
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

        contours, _ = cv2.findContours(
            mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )

        for contour in contours:
            if cv2.contourArea(contour) >= self._min_area:
                return True

        return False
