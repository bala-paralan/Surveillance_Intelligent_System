"""
SurveillanceOS — Analytics microservice entrypoint.

Exposes FastAPI routes for:
- Frame-level YOLO + motion + intrusion detection
- Zone management
- Liveness probe

Internal service: all origins allowed (deployed behind API gateway / service mesh).
Runs on port 8001.
"""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from analytics.api.routes import router

logger = logging.getLogger(__name__)

app = FastAPI(
    title="SurveillanceOS Analytics",
    description="AI-based video analytics microservice: YOLOv8 detection, motion, intrusion.",
    version="1.0.0",
)

# CORS — internal microservice; gateway enforces external auth
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.on_event("startup")
async def _startup() -> None:
    """Pre-load the YOLO model on startup so the first request is fast."""
    try:
        from analytics.api.routes import get_detector

        get_detector()
        logger.info("YoloDetector pre-loaded successfully")
    except Exception as exc:  # pragma: no cover
        logger.warning(
            "YoloDetector failed to pre-load (stub mode active): %s", exc
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("analytics.main:app", host="0.0.0.0", port=8001, reload=False)
