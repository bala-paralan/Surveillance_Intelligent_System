/**
 * HLS stream proxy service — TASK-004.
 * Spawns an FFmpeg process per camera that transcodes RTSP → HLS segments.
 * Streams are auto-killed after IDLE_TIMEOUT_MS of no segment requests.
 * Raw RTSP URLs never leave this module.
 */
import path from 'path';
import fs from 'fs/promises';
import ffmpeg from 'fluent-ffmpeg';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { getDecryptedRtspUrl } from './camera-service.js';
import { NotFoundError } from '../errors.js';

const IDLE_TIMEOUT_MS = 60_000; // kill stream after 60 s of no requests
const HLS_TIME       = 2;       // segment duration (s)
const HLS_LIST_SIZE  = 6;       // segments kept in playlist

interface ActiveStream {
  cameraId:    string;
  proc:        ReturnType<typeof ffmpeg>;
  hlsDir:      string;
  lastTouched: number;
  idleTimer:   ReturnType<typeof setTimeout>;
}

const streams = new Map<string, ActiveStream>();

// ── Helpers ───────────────────────────────────────────────────────────────────

const hlsDirFor = (cameraId: string): string =>
  path.join(config.HLS_DIR, cameraId);

const resetIdle = (stream: ActiveStream): void => {
  clearTimeout(stream.idleTimer);
  stream.lastTouched = Date.now();
  stream.idleTimer = setTimeout(() => {
    logger.info({ cameraId: stream.cameraId }, 'HLS stream idle — stopping');
    stopStream(stream.cameraId).catch(() => undefined);
  }, IDLE_TIMEOUT_MS);
};

// ── Public API ────────────────────────────────────────────────────────────────

export const startStream = async (
  cameraId: string
): Promise<{ hlsPath: string }> => {
  // Return existing stream
  const existing = streams.get(cameraId);
  if (existing) {
    resetIdle(existing);
    return { hlsPath: existing.hlsDir };
  }

  const rtspUrl = await getDecryptedRtspUrl(cameraId); // throws NotFoundError if missing
  const hlsDir  = hlsDirFor(cameraId);
  await fs.mkdir(hlsDir, { recursive: true });

  const playlistPath = path.join(hlsDir, 'stream.m3u8');
  const segmentPath  = path.join(hlsDir, 'seg%03d.ts');

  return new Promise((resolve, reject) => {
    const proc = ffmpeg(rtspUrl)
      .inputOptions([
        '-rtsp_transport', 'tcp',
        '-re',
      ])
      .videoCodec('copy')
      .audioCodec('aac')
      .outputOptions([
        '-f',              'hls',
        '-hls_time',       String(HLS_TIME),
        '-hls_list_size',  String(HLS_LIST_SIZE),
        '-hls_flags',      'delete_segments+append_list',
        '-hls_segment_filename', segmentPath,
      ])
      .output(playlistPath);

    let started = false;

    proc.on('start', (cmd) => {
      logger.info({ cameraId, cmd }, 'FFmpeg started');
    });

    proc.on('stderr', (line: string) => {
      // Detect first segment written → stream is ready
      if (!started && line.includes('seg000.ts')) {
        started = true;

        const idleTimer = setTimeout(() => {
          logger.info({ cameraId }, 'HLS stream idle — stopping');
          stopStream(cameraId).catch(() => undefined);
        }, IDLE_TIMEOUT_MS);

        streams.set(cameraId, {
          cameraId,
          proc,
          hlsDir,
          lastTouched: Date.now(),
          idleTimer,
        });

        resolve({ hlsPath: hlsDir });
      }
    });

    proc.on('error', (err) => {
      streams.delete(cameraId);
      if (!started) {
        reject(new Error(`FFmpeg error: ${err.message}`));
      } else {
        logger.error({ cameraId, err: err.message }, 'FFmpeg stream error');
      }
    });

    proc.on('end', () => {
      streams.delete(cameraId);
      logger.info({ cameraId }, 'FFmpeg stream ended');
    });

    proc.run();

    // Fallback: resolve after 8 s even if seg000.ts line not yet seen
    setTimeout(() => {
      if (!started) {
        started = true;
        const idleTimer = setTimeout(() => {
          stopStream(cameraId).catch(() => undefined);
        }, IDLE_TIMEOUT_MS);

        streams.set(cameraId, {
          cameraId,
          proc,
          hlsDir,
          lastTouched: Date.now(),
          idleTimer,
        });

        resolve({ hlsPath: hlsDir });
      }
    }, 8_000);
  });
};

export const stopStream = async (cameraId: string): Promise<void> => {
  const stream = streams.get(cameraId);
  if (!stream) throw new NotFoundError('Stream');

  clearTimeout(stream.idleTimer);
  stream.proc.kill('SIGTERM');
  streams.delete(cameraId);

  // Clean up HLS segments
  try {
    await fs.rm(stream.hlsDir, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
};

export const touchStream = (cameraId: string): void => {
  const stream = streams.get(cameraId);
  if (stream) resetIdle(stream);
};

export const listActiveStreams = (): Array<{ cameraId: string; lastTouched: number }> =>
  Array.from(streams.values()).map(({ cameraId, lastTouched }) => ({ cameraId, lastTouched }));

export const stopAllStreams = async (): Promise<void> => {
  const ids = Array.from(streams.keys());
  await Promise.allSettled(ids.map(stopStream));
};
