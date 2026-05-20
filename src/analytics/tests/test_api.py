"""
Integration tests for the Analytics FastAPI application.

Uses httpx.AsyncClient with ASGITransport so no network socket is needed.
"""
from __future__ import annotations

import io
import json

import cv2
import numpy as np
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from analytics.main import app


# ── helpers ───────────────────────────────────────────────────────────────────


def _make_jpeg_bytes(width: int = 64, height: int = 48) -> bytes:
    """Return a minimal valid JPEG byte string."""
    img = np.zeros((height, width, 3), dtype=np.uint8)
    # Add a white square so the image is not completely blank
    img[10:38, 10:54] = 200
    success, buf = cv2.imencode(".jpg", img)
    assert success, "cv2.imencode failed in test helper"
    return buf.tobytes()


# ── fixtures ──────────────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def client() -> AsyncClient:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ── tests ─────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_health_returns_ok(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "model_loaded" in body
    assert "ts" in body


@pytest.mark.asyncio
async def test_detect_endpoint_accepts_image(client: AsyncClient) -> None:
    jpeg_bytes = _make_jpeg_bytes()
    files = {"frame": ("test.jpg", io.BytesIO(jpeg_bytes), "image/jpeg")}
    data = {"camera_id": "cam-test-001"}

    response = await client.post("/detect", files=files, data=data)
    assert response.status_code == 200

    body = response.json()
    assert "detections" in body
    assert "intrusions" in body
    assert "motion_detected" in body
    assert "camera_id" in body
    assert body["camera_id"] == "cam-test-001"
    assert "ts" in body
    # detections is a list (may be empty or have stub detections)
    assert isinstance(body["detections"], list)


@pytest.mark.asyncio
async def test_detect_endpoint_bad_image(client: AsyncClient) -> None:
    """Submitting garbage bytes must return 400."""
    files = {"frame": ("bad.jpg", io.BytesIO(b"not an image"), "image/jpeg")}
    data = {"camera_id": "cam-test-001"}

    response = await client.post("/detect", files=files, data=data)
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_zones_crud(client: AsyncClient) -> None:
    """POST zones then GET them back — values must round-trip correctly."""
    camera_id = "cam-zone-test"
    zones_payload = {
        "camera_id": camera_id,
        "zones": [
            {
                "zone_id": "z1",
                "camera_id": camera_id,
                "polygon": [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]],
            }
        ],
    }

    post_response = await client.post("/zones", json=zones_payload)
    assert post_response.status_code == 200
    assert post_response.json()["registered"] == 1

    get_response = await client.get(f"/zones/{camera_id}")
    assert get_response.status_code == 200

    body = get_response.json()
    assert body["camera_id"] == camera_id
    assert len(body["zones"]) == 1
    assert body["zones"][0]["zone_id"] == "z1"


@pytest.mark.asyncio
async def test_zones_get_unknown_camera(client: AsyncClient) -> None:
    """GET /zones for an unknown camera must return an empty list (not 404)."""
    response = await client.get("/zones/nonexistent-cam-xyz")
    assert response.status_code == 200
    body = response.json()
    assert body["zones"] == []


@pytest.mark.asyncio
async def test_detect_with_inline_zones(client: AsyncClient) -> None:
    """POST /detect with a zones JSON string should not raise an error."""
    jpeg_bytes = _make_jpeg_bytes()
    zones_json = json.dumps(
        [
            {
                "zone_id": "z1",
                "camera_id": "cam-inline",
                "polygon": [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]],
            }
        ]
    )
    files = {"frame": ("test.jpg", io.BytesIO(jpeg_bytes), "image/jpeg")}
    data = {"camera_id": "cam-inline", "zones": zones_json}

    response = await client.post("/detect", files=files, data=data)
    assert response.status_code == 200
