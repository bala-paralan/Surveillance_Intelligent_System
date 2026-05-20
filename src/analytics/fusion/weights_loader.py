"""
Fusion weights loader.

Tries to load weights from a YAML file; falls back to the hardcoded defaults
from :mod:`analytics.fusion.bayes` so that CI always succeeds without a file.
"""
from __future__ import annotations

import logging
import os

from analytics.fusion.bayes import DEFAULT_WEIGHTS, FusionWeights

logger = logging.getLogger(__name__)


def load_weights(path: str = "fusion/weights.yaml") -> list[FusionWeights]:
    """
    Load fusion weights from *path*.

    If the file does not exist or cannot be parsed, the hardcoded defaults
    are returned (CI-safe).

    Parameters
    ----------
    path:
        Filesystem path to the YAML weights file.

    Returns
    -------
    list[FusionWeights]
    """
    resolved = path if os.path.isabs(path) else os.path.join(os.getcwd(), path)

    if not os.path.exists(resolved):
        logger.info(
            "Fusion weights file not found at %s — using hardcoded defaults", resolved
        )
        return _defaults()

    try:
        import yaml  # type: ignore[import-untyped]

        with open(resolved, encoding="utf-8") as fh:
            data = yaml.safe_load(fh)

        if not isinstance(data, list):
            raise ValueError("weights.yaml must contain a top-level list of weight objects")

        weights: list[FusionWeights] = []
        for entry in data:
            weights.append(
                FusionWeights(
                    class_name=str(entry["class_name"]),
                    prior=float(entry["prior"]),
                    likelihoods={str(k): float(v) for k, v in entry["likelihoods"].items()},
                )
            )

        logger.info("Loaded %d fusion weight entries from %s", len(weights), resolved)
        return weights

    except Exception as exc:
        logger.warning(
            "Failed to parse fusion weights from %s: %s — falling back to defaults",
            resolved,
            exc,
        )
        return _defaults()


def _defaults() -> list[FusionWeights]:
    """Convert the hardcoded DEFAULT_WEIGHTS dicts to FusionWeights instances."""
    return [
        FusionWeights(
            class_name=entry["class_name"],
            prior=float(entry["prior"]),
            likelihoods={str(k): float(v) for k, v in entry["likelihoods"].items()},
        )
        for entry in DEFAULT_WEIGHTS
    ]
