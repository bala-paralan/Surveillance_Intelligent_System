/**
 * BullMQ recording job processor — TASK-012.
 *
 * Job types:
 *   'start-recording'  { cameraId, durationS, recordingId }
 *   'stop-recording'   { cameraId, recordingId }
 *   'tier-migrate'     { recordingId, targetTier }
 *
 * SECURITY: Raw video is NEVER stored on the application server.
 *   storagePath is always an object-storage key (e.g. s3://sis-recordings/…).
 *   For v1, a placeholder path is generated and the intent is logged.
 */

import { Queue, Worker, type Job } from 'bullmq';
import { prisma } from '../db.js';
import { logger } from '../logger.js';
import { startStream, stopStream } from '../services/stream-service.js';
import { config } from '../config.js';

// ── Redis connection opts ─────────────────────────────────────────────────────

const parsedRedisUrl = new URL(config.REDIS_URL);
const redisConnection = {
  host: parsedRedisUrl.hostname,
  // URL spec: .port is '' if not specified, else a numeric string.
  port: Number(parsedRedisUrl.port || /* v8 ignore next */ '6379'),
};

// ── Queue ─────────────────────────────────────────────────────────────────────

export const recordingQueue = new Queue('recording', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

// ── Job payload types ─────────────────────────────────────────────────────────

interface StartRecordingPayload {
  cameraId: string;
  durationS: number;
  recordingId: string;
}

interface StopRecordingPayload {
  cameraId: string;
  recordingId: string;
}

interface TierMigratePayload {
  recordingId: string;
  targetTier: 'HOT' | 'WARM' | 'COLD';
}

type JobPayload =
  | StartRecordingPayload
  | StopRecordingPayload
  | TierMigratePayload;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a placeholder object-storage key.
 * Real implementation would use AWS S3 / MinIO / GCS SDK.
 * NEVER references a local filesystem path.
 */
const buildStoragePath = (cameraId: string, recordingId: string): string => {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `s3://sis-recordings/${cameraId}/${ts}-${recordingId}.mp4`;
};

// ── Processor ─────────────────────────────────────────────────────────────────

const processJob = async (job: Job<JobPayload>): Promise<void> => {
  try {
    switch (job.name) {
      case 'start-recording': {
        const { cameraId, durationS, recordingId } =
          job.data as StartRecordingPayload;

        logger.info({ cameraId, recordingId }, 'Starting recording');

        // Mark as RECORDING
        await prisma.recording.update({
          where: { id: recordingId },
          data: { status: 'RECORDING', startedAt: new Date() },
        });

        // Start HLS stream (FFmpeg → HLS segments → object storage in production)
        await startStream(cameraId);

        logger.info(
          { cameraId, recordingId, durationS },
          'Recording stream started — scheduling stop job'
        );

        // Schedule stop after durationS
        await recordingQueue.add(
          'stop-recording',
          { cameraId, recordingId } satisfies StopRecordingPayload,
          { delay: durationS * 1_000 }
        );
        break;
      }

      case 'stop-recording': {
        const { cameraId, recordingId } = job.data as StopRecordingPayload;
        const now = new Date();

        logger.info({ cameraId, recordingId }, 'Stopping recording');

        // Stop HLS stream (best-effort — stream may have already ended)
        try {
          await stopStream(cameraId);
        } catch {
          // Stream already cleaned up — continue
        }

        const storagePath = buildStoragePath(cameraId, recordingId);
        logger.info(
          { cameraId, recordingId, storagePath },
          'Recording complete — placeholder storage path assigned (v1)'
        );

        const rec = await prisma.recording.findUnique({
          where: { id: recordingId },
          select: { startedAt: true },
        });

        const durationS = rec
          ? Math.round((now.getTime() - rec.startedAt.getTime()) / 1_000)
          : null;

        await prisma.recording.update({
          where: { id: recordingId },
          data: {
            status: 'STORED',
            endedAt: now,
            durationS,
            storagePath,
          },
        });
        break;
      }

      case 'tier-migrate': {
        const { recordingId, targetTier } = job.data as TierMigratePayload;

        logger.info({ recordingId, targetTier }, 'Migrating recording storage tier');

        await prisma.recording.update({
          where: { id: recordingId },
          data: { storageTier: targetTier },
        });
        break;
      }

      default:
        logger.warn({ jobName: job.name }, 'Unknown recording job type — skipping');
    }
  } catch (err) {
    logger.error({ err, jobName: job.name, jobId: job.id }, 'Recording job failed');
    throw err; // BullMQ will retry per backoff config
  }
};

// ── Worker ────────────────────────────────────────────────────────────────────

export const recordingWorker = new Worker<JobPayload>(
  'recording',
  processJob,
  { connection: redisConnection, concurrency: 4 }
);

recordingWorker.on('completed', (job) => {
  logger.info({ jobName: job.name, jobId: job.id }, 'Recording job completed');
});

recordingWorker.on('failed', (job, err) => {
  logger.error(
    { jobName: job?.name, jobId: job?.id, err: err.message },
    'Recording job failed permanently'
  );
});

// ── Public helper ─────────────────────────────────────────────────────────────

/**
 * Create a Recording row and enqueue a start-recording job.
 * Returns the new recordingId.
 */
export const scheduleRecording = async (
  cameraId: string,
  durationS: number
): Promise<string> => {
  const recording = await prisma.recording.create({
    data: {
      cameraId,
      startedAt: new Date(),
      status: 'SCHEDULED',
    },
  });

  await recordingQueue.add('start-recording', {
    cameraId,
    durationS,
    recordingId: recording.id,
  } satisfies StartRecordingPayload);

  logger.info(
    { cameraId, recordingId: recording.id, durationS },
    'Recording scheduled'
  );

  return recording.id;
};
