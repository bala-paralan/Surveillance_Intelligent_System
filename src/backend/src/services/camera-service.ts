/**
 * Camera service — business logic, credential encryption, RTSP test.
 * RTSP URLs and credentials are ALWAYS encrypted before DB writes,
 * and NEVER appear in responses or logs.
 */
import { z } from 'zod';
import { createConnection } from 'net';
import { encrypt, decrypt } from '../crypto.js';
import { cameraRepo } from '../repositories/camera-repo.js';
import { NotFoundError } from '../errors.js';
import type { CameraStatus } from '@prisma/client';

// ── Input schemas ─────────────────────────────────────────────────────────────

export const CreateCameraSchema = z.object({
  name:         z.string().min(1).max(100),
  rtspUrl:      z.string().url().startsWith('rtsp://'),
  username:     z.string().optional(),
  password:     z.string().optional(),
  manufacturer: z.string().optional(),
  model:        z.string().optional(),
  siteId:       z.string().optional(),
  location:     z.string().optional(),
});
export type CreateCameraInput = z.infer<typeof CreateCameraSchema>;

export const UpdateCameraSchema = CreateCameraSchema.partial();
export type UpdateCameraInput = z.infer<typeof UpdateCameraSchema>;

export const ListCamerasSchema = z.object({
  siteId: z.string().optional(),
  status: z.enum(['ONLINE','OFFLINE','DEGRADED','ERROR','MAINTENANCE']).optional(),
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(200).default(50),
});

// ── Safe public shape (no encrypted fields) ───────────────────────────────────

export interface CameraPublic {
  id:           string;
  name:         string;
  manufacturer: string | null;
  model:        string | null;
  siteId:       string | null;
  location:     string | null;
  status:       CameraStatus;
  lastSeenAt:   Date | null;
  createdBy:    string;
  createdAt:    Date;
  updatedAt:    Date;
}

// ── Service functions ─────────────────────────────────────────────────────────

export const createCamera = async (
  input: CreateCameraInput,
  createdBy: string
): Promise<CameraPublic> => {
  const row = await cameraRepo.create({
    name:              input.name,
    rtspUrlEncrypted:  encrypt(input.rtspUrl),
    usernameEncrypted: input.username ? encrypt(input.username) : null,
    passwordEncrypted: input.password ? encrypt(input.password) : null,
    manufacturer:      input.manufacturer ?? null,
    model:             input.model ?? null,
    siteId:            input.siteId ?? null,
    location:          input.location ?? null,
    createdBy,
  });
  return toPublic(row);
};

export const listCameras = async (filters: z.infer<typeof ListCamerasSchema>) => {
  const { total, page, limit, rows } = await cameraRepo.list(filters);
  return { total, page, limit, count: rows.length, cameras: rows };
};

export const getCameraById = async (id: string): Promise<CameraPublic> => {
  const row = await cameraRepo.findById(id);
  if (!row) throw new NotFoundError('Camera');
  return toPublic(row);
};

export const updateCamera = async (
  id: string,
  input: UpdateCameraInput
): Promise<CameraPublic> => {
  const existing = await cameraRepo.findById(id);
  if (!existing) throw new NotFoundError('Camera');

  const data: Record<string, unknown> = {};
  if (input.name         !== undefined) data.name              = input.name;
  if (input.rtspUrl      !== undefined) data.rtspUrlEncrypted  = encrypt(input.rtspUrl);
  if (input.username     !== undefined) data.usernameEncrypted = encrypt(input.username);
  if (input.password     !== undefined) data.passwordEncrypted = encrypt(input.password);
  if (input.manufacturer !== undefined) data.manufacturer      = input.manufacturer;
  if (input.model        !== undefined) data.model             = input.model;
  if (input.siteId       !== undefined) data.siteId            = input.siteId;
  if (input.location     !== undefined) data.location          = input.location;

  const updated = await cameraRepo.update(id, data);
  return toPublic(updated);
};

export const deleteCamera = async (id: string): Promise<void> => {
  const existing = await cameraRepo.findById(id);
  if (!existing) throw new NotFoundError('Camera');
  await cameraRepo.delete(id);
};

/** Test RTSP reachability by TCP-connecting to host:port (default 554). */
export const testCamera = async (
  id: string
): Promise<{ reachable: boolean; latency_ms: number | null; message: string }> => {
  const row = await cameraRepo.findById(id);
  if (!row) throw new NotFoundError('Camera');

  const rtspUrl = decrypt(row.rtspUrlEncrypted);
  const parsed  = new URL(rtspUrl);
  const host    = parsed.hostname;
  const port    = parseInt(parsed.port || '554', 10);

  const start = Date.now();
  return new Promise((resolve) => {
    const sock = createConnection({ host, port, timeout: 4000 }, () => {
      const latency_ms = Date.now() - start;
      sock.destroy();
      resolve({ reachable: true, latency_ms, message: `TCP reachable at ${host}:${port}` });
    });
    sock.on('error', (err) => {
      resolve({ reachable: false, latency_ms: null, message: err.message });
    });
    sock.on('timeout', () => {
      sock.destroy();
      resolve({ reachable: false, latency_ms: null, message: 'Connection timed out' });
    });
  });
};

/** Retrieve decrypted RTSP URL for internal use (stream proxy only). */
export const getDecryptedRtspUrl = async (id: string): Promise<string> => {
  const row = await cameraRepo.findById(id);
  if (!row) throw new NotFoundError('Camera');
  const base = decrypt(row.rtspUrlEncrypted);
  // Embed credentials into URL if stored separately
  if (row.usernameEncrypted && row.passwordEncrypted) {
    const u = decrypt(row.usernameEncrypted);
    const p = decrypt(row.passwordEncrypted);
    const url = new URL(base);
    url.username = encodeURIComponent(u);
    url.password = encodeURIComponent(p);
    return url.toString();
  }
  return base;
};

// ── Private helpers ───────────────────────────────────────────────────────────

const toPublic = (row: {
  id: string; name: string; manufacturer: string | null; model: string | null;
  siteId: string | null; location: string | null; status: CameraStatus;
  lastSeenAt: Date | null; createdBy: string; createdAt: Date; updatedAt: Date;
}): CameraPublic => ({
  id:           row.id,
  name:         row.name,
  manufacturer: row.manufacturer,
  model:        row.model,
  siteId:       row.siteId,
  location:     row.location,
  status:       row.status,
  lastSeenAt:   row.lastSeenAt,
  createdBy:    row.createdBy,
  createdAt:    row.createdAt,
  updatedAt:    row.updatedAt,
});
