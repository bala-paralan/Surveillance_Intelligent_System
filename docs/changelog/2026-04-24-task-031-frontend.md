# TASK-031: AOI Drawing Tool — Frontend Implementation

**Date:** 2026-04-24
**Agent:** Frontend
**Status:** Complete

## Summary

Implemented the AOI (Area of Interest) drawing tool and management UI.

## Changes

### New files
- `src/frontend/src/api/aoi.ts` — typed API client for `/aoi` CRUD, export, and import
- `src/frontend/src/store/aoiStore.ts` — Zustand store: `aois[]`, `activeAoiId`, `draft`, `loading`; actions: `fetchAois`, `addAoi`, `updateAoi`, `removeAoi`, `setActiveAoi`, `setDraft`
- `src/frontend/src/components/map/AoiMap.tsx` — MapLibre GL map with `@mapbox/mapbox-gl-draw` polygon drawing; AOI fill/outline layers rendered per AOI; "Draw AOI" button activates draw mode; `draw.create` handler prompts for name then POSTs to backend
- `src/frontend/src/components/map/AoiList.tsx` — sidebar list of AOIs with vertex count, last-modified date, active highlight, zoom-to, and delete (ADMIN/OPERATOR only)
- `src/frontend/src/pages/AoiPage.tsx` — page layout: header with Import GeoJSON / Export buttons, left sidebar (`AoiList`), main area (`AoiMap`)

## Map Details

- Base style: `https://demotiles.maplibre.org/style.json` (free OSM tiles, no API key)
- Default center: `[88.17, 21.96]`, zoom 10
- Each AOI rendered as a separate GeoJSON source + fill + line layers
- Active AOI highlighted in blue; inactive in indigo
- GeoJSON import reads a local file and calls `POST /aoi/import`; result count shown in header
- GeoJSON export calls `GET /aoi/:id/export` and triggers a browser file download
