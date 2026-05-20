"""
Prometheus metrics for SurveillanceOS Analytics microservice.

Metrics exposed:
  detection_requests_total{detector_type}   — Counter
  detection_errors_total{detector_type}     — Counter
  detection_latency_seconds{detector_type}  — Histogram

Endpoint:
  GET /metrics — returns prometheus text format (no auth — internal scraping)
"""
from __future__ import annotations

from fastapi import APIRouter, Response
from prometheus_client import (
    Counter,
    Histogram,
    generate_latest,
    CONTENT_TYPE_LATEST,
    CollectorRegistry,
    REGISTRY,
)

# ── Metrics ───────────────────────────────────────────────────────────────────

detection_requests_total = Counter(
    "detection_requests_total",
    "Total detection requests processed",
    ["detector_type"],
    registry=REGISTRY,
)

detection_errors_total = Counter(
    "detection_errors_total",
    "Total detection errors encountered",
    ["detector_type"],
    registry=REGISTRY,
)

detection_latency_seconds = Histogram(
    "detection_latency_seconds",
    "Detection inference latency in seconds",
    ["detector_type"],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
    registry=REGISTRY,
)

# ── Router ────────────────────────────────────────────────────────────────────

metrics_router = APIRouter(tags=["observability"])


@metrics_router.get(
    "/metrics",
    summary="Prometheus metrics scrape endpoint",
    response_class=Response,
)
def get_metrics() -> Response:
    """Return Prometheus-format metrics for scraping by the Prometheus server."""
    data = generate_latest(REGISTRY)
    return Response(content=data, media_type=CONTENT_TYPE_LATEST)
