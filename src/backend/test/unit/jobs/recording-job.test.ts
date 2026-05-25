import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismaStub, resetPrismaStub } from '../../utils/prisma-stub.js';

vi.mock('../../../src/db.js', () => ({ prisma: prismaStub }));

// Capture the worker's processor function so we can drive jobs directly.
const queueAddSpy = vi.fn();
let workerProcessor: ((job: { name: string; data: unknown; id?: string }) => Promise<void>) | undefined;
const workerListeners: Record<string, Array<(...args: unknown[]) => void>> = {};

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: queueAddSpy,
  })),
  Worker: vi.fn().mockImplementation((_name: string, processor: typeof workerProcessor) => {
    workerProcessor = processor;
    const w = {
      on: (event: string, fn: (...a: unknown[]) => void) => {
        (workerListeners[event] ??= []).push(fn);
        return w;
      },
    };
    return w;
  }),
}));

// Mock the stream service so we don't actually spawn ffmpeg
const startStreamSpy = vi.fn().mockResolvedValue(undefined);
const stopStreamSpy = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../src/services/stream-service.js', () => ({
  startStream: (...args: unknown[]) => startStreamSpy(...args),
  stopStream:  (...args: unknown[]) => stopStreamSpy(...args),
}));

const { scheduleRecording } = await import('../../../src/jobs/recording-job.js');

const runJob = async (name: string, data: unknown, id = 'job-1') => {
  if (!workerProcessor) throw new Error('worker processor not bound');
  await workerProcessor({ name, data, id });
};

describe('jobs/recording-job', () => {
  beforeEach(() => {
    resetPrismaStub();
    queueAddSpy.mockReset();
    startStreamSpy.mockReset();
    startStreamSpy.mockResolvedValue(undefined);
    stopStreamSpy.mockReset();
    stopStreamSpy.mockResolvedValue(undefined);
  });

  it('scheduleRecording creates a Recording row and enqueues a start-recording job', async () => {
    prismaStub.recording.create.mockResolvedValue({ id: 'rec_1' });
    const id = await scheduleRecording('cam_1', 300);
    expect(id).toBe('rec_1');
    expect(queueAddSpy).toHaveBeenCalledWith(
      'start-recording',
      { cameraId: 'cam_1', durationS: 300, recordingId: 'rec_1' },
    );
  });

  it('start-recording job: marks RECORDING, starts stream, schedules stop', async () => {
    prismaStub.recording.update.mockResolvedValue({});
    await runJob('start-recording', { cameraId: 'cam_x', recordingId: 'rec_x', durationS: 60 });
    expect(prismaStub.recording.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rec_x' },
        data:  expect.objectContaining({ status: 'RECORDING' }),
      }),
    );
    expect(startStreamSpy).toHaveBeenCalledWith('cam_x');
    expect(queueAddSpy).toHaveBeenCalledWith(
      'stop-recording',
      { cameraId: 'cam_x', recordingId: 'rec_x' },
      expect.objectContaining({ delay: 60_000 }),
    );
  });

  it('stop-recording job: stops stream, computes duration, marks STORED', async () => {
    prismaStub.recording.findUnique.mockResolvedValue({
      startedAt: new Date(Date.now() - 30_000),
    });
    prismaStub.recording.update.mockResolvedValue({});
    await runJob('stop-recording', { cameraId: 'cam_x', recordingId: 'rec_x' });
    expect(stopStreamSpy).toHaveBeenCalledWith('cam_x');
    const data = prismaStub.recording.update.mock.calls[0]![0].data;
    expect(data.status).toBe('STORED');
    expect(typeof data.durationS).toBe('number');
    expect(data.storagePath).toMatch(/^s3:\/\/sis-recordings\/cam_x\//);
  });

  it('stop-recording job tolerates stopStream failures (best-effort)', async () => {
    stopStreamSpy.mockRejectedValue(new Error('already gone'));
    prismaStub.recording.findUnique.mockResolvedValue({
      startedAt: new Date(),
    });
    prismaStub.recording.update.mockResolvedValue({});
    await runJob('stop-recording', { cameraId: 'cam_y', recordingId: 'rec_y' });
    expect(prismaStub.recording.update).toHaveBeenCalled();
  });

  it('stop-recording job: durationS is null when recording row missing', async () => {
    prismaStub.recording.findUnique.mockResolvedValue(null);
    prismaStub.recording.update.mockResolvedValue({});
    await runJob('stop-recording', { cameraId: 'cam_z', recordingId: 'rec_z' });
    const data = prismaStub.recording.update.mock.calls[0]![0].data;
    expect(data.durationS).toBeNull();
  });

  it('tier-migrate job updates storageTier', async () => {
    prismaStub.recording.update.mockResolvedValue({});
    await runJob('tier-migrate', { recordingId: 'rec_t', targetTier: 'COLD' });
    expect(prismaStub.recording.update).toHaveBeenCalledWith({
      where: { id: 'rec_t' },
      data:  { storageTier: 'COLD' },
    });
  });

  it('unknown job names are logged and skipped (no throw)', async () => {
    await expect(runJob('mystery', {})).resolves.toBeUndefined();
  });

  it('processor rethrows when a DB call fails (BullMQ retries)', async () => {
    prismaStub.recording.update.mockRejectedValue(new Error('db err'));
    await expect(
      runJob('tier-migrate', { recordingId: 'r', targetTier: 'HOT' }),
    ).rejects.toThrow('db err');
  });

  it('completed/failed worker listeners are registered and tolerate missing job', () => {
    expect(workerListeners['completed']?.length).toBeGreaterThan(0);
    expect(workerListeners['failed']?.length).toBeGreaterThan(0);
    workerListeners['completed']![0]!({ name: 'start-recording', id: 'j-1' });
    workerListeners['failed']![0]!(undefined, new Error('x'));
    workerListeners['failed']![0]!({ name: 'foo', id: 'j' }, new Error('y'));
  });
});
