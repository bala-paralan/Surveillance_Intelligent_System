import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

// ── Mock fluent-ffmpeg with a controllable EventEmitter-based proc factory ───
type ProcMock = EventEmitter & {
  inputOptions: (...args: unknown[]) => ProcMock;
  videoCodec: (...args: unknown[]) => ProcMock;
  audioCodec: (...args: unknown[]) => ProcMock;
  outputOptions: (...args: unknown[]) => ProcMock;
  output: (...args: unknown[]) => ProcMock;
  run: () => void;
  kill: (signal?: string) => void;
};

let lastProc: ProcMock | undefined;
let onRun: ((proc: ProcMock) => void) | undefined;

const makeProc = (): ProcMock => {
  const proc = new EventEmitter() as ProcMock;
  proc.inputOptions = () => proc;
  proc.videoCodec = () => proc;
  proc.audioCodec = () => proc;
  proc.outputOptions = () => proc;
  proc.output = () => proc;
  proc.run = () => { onRun?.(proc); };
  proc.kill = vi.fn();
  return proc;
};

vi.mock('fluent-ffmpeg', () => ({
  default: () => {
    lastProc = makeProc();
    return lastProc;
  },
}));

const mkdirMock = vi.fn().mockResolvedValue(undefined);
const rmMock = vi.fn().mockResolvedValue(undefined);
vi.mock('fs/promises', () => ({
  default: { mkdir: mkdirMock, rm: rmMock },
  mkdir: mkdirMock,
  rm: rmMock,
}));

// camera-service.getDecryptedRtspUrl: just return something for stream-service
vi.mock('../../../src/services/camera-service.js', () => ({
  getDecryptedRtspUrl: vi.fn().mockResolvedValue('rtsp://host/s'),
}));

const {
  startStream,
  stopStream,
  touchStream,
  listActiveStreams,
  stopAllStreams,
} = await import('../../../src/services/stream-service.js');

describe('services/stream-service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    lastProc = undefined;
    onRun = undefined;
  });

  afterEach(async () => {
    // Clear any registered streams between tests
    for (const s of listActiveStreams()) {
      await stopStream(s.cameraId).catch(() => undefined);
    }
    vi.useRealTimers();
  });

  it('startStream resolves on first stderr "seg000.ts" line and registers the stream', async () => {
    onRun = (proc) => {
      // Emit "start" once for log coverage, then segment marker
      setTimeout(() => proc.emit('start', 'ffmpeg ...'), 0);
      setTimeout(() => proc.emit('stderr', 'opening seg000.ts'), 10);
    };
    const promise = startStream('cam-A');
    await vi.advanceTimersByTimeAsync(50);
    const out = await promise;
    expect(out.hlsPath).toMatch(/cam-A$/);
    expect(listActiveStreams().some((s) => s.cameraId === 'cam-A')).toBe(true);
  });

  it('startStream returns the existing entry when called twice', async () => {
    onRun = (proc) => setTimeout(() => proc.emit('stderr', 'seg000.ts'), 5);
    const promise = startStream('cam-A');
    await vi.advanceTimersByTimeAsync(50);
    await promise;
    // Second call should not spawn a new proc — should return existing
    const out = await startStream('cam-A');
    expect(out.hlsPath).toMatch(/cam-A$/);
  });

  it('startStream falls back to the 8s timeout when no seg marker arrives', async () => {
    onRun = () => undefined;  // never emit anything
    const promise = startStream('cam-Slow');
    await vi.advanceTimersByTimeAsync(9_000);
    const out = await promise;
    expect(out.hlsPath).toMatch(/cam-Slow$/);
  });

  it('startStream rejects when ffmpeg errors before any segment', async () => {
    onRun = (proc) => setTimeout(() => proc.emit('error', new Error('bad input')), 5);
    const promise = startStream('cam-Err');
    // Attach catch handler synchronously to silence "unhandled rejection" warning
    const caught = promise.catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(50);
    const err = await caught;
    expect((err as Error).message).toMatch(/bad input/);
  });

  it('startStream handles post-start errors and end events without throwing', async () => {
    onRun = (proc) => setTimeout(() => proc.emit('stderr', 'seg000.ts'), 5);
    const promise = startStream('cam-Post');
    await vi.advanceTimersByTimeAsync(50);
    await promise;

    // Emit a late error and end on the SAME proc that was registered
    lastProc!.emit('error', new Error('late'));
    lastProc!.emit('end');
    // No exception should leak; stream entry should be removed by 'end'
    expect(listActiveStreams().some((s) => s.cameraId === 'cam-Post')).toBe(false);
  });

  it('stopStream throws NotFoundError when no such stream', async () => {
    await expect(stopStream('unknown')).rejects.toThrow(/Stream not found/);
  });

  it('idle timeout auto-stops the stream', async () => {
    onRun = (proc) => setTimeout(() => proc.emit('stderr', 'seg000.ts'), 5);
    const promise = startStream('cam-Idle');
    await vi.advanceTimersByTimeAsync(50);
    await promise;
    // Advance past 60s idle timeout
    await vi.advanceTimersByTimeAsync(61_000);
    expect(listActiveStreams().some((s) => s.cameraId === 'cam-Idle')).toBe(false);
  });

  it('touchStream resets the idle timer (only when the stream exists)', async () => {
    // No-op when stream missing
    touchStream('nonexistent'); // no throw

    onRun = (proc) => setTimeout(() => proc.emit('stderr', 'seg000.ts'), 5);
    const promise = startStream('cam-Touch');
    await vi.advanceTimersByTimeAsync(50);
    await promise;
    await vi.advanceTimersByTimeAsync(50_000);
    touchStream('cam-Touch'); // resets idle
    await vi.advanceTimersByTimeAsync(50_000);
    expect(listActiveStreams().some((s) => s.cameraId === 'cam-Touch')).toBe(true);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(listActiveStreams().some((s) => s.cameraId === 'cam-Touch')).toBe(false);
  });

  it('listActiveStreams returns lastTouched per active stream', async () => {
    onRun = (proc) => setTimeout(() => proc.emit('stderr', 'seg000.ts'), 5);
    const p = startStream('cam-List');
    await vi.advanceTimersByTimeAsync(50);
    await p;
    const list = listActiveStreams();
    expect(list.some((s) => typeof s.lastTouched === 'number')).toBe(true);
  });

  it('stopAllStreams runs cleanup on all active streams (allSettled tolerates failures)', async () => {
    onRun = (proc) => setTimeout(() => proc.emit('stderr', 'seg000.ts'), 5);
    const p1 = startStream('cam-1');
    await vi.advanceTimersByTimeAsync(50);
    await p1;
    const p2 = startStream('cam-2');
    await vi.advanceTimersByTimeAsync(50);
    await p2;

    await stopAllStreams();
    expect(listActiveStreams().length).toBe(0);
  });

  it('idle timer fires after the 8s fallback as well', async () => {
    onRun = () => undefined;
    const promise = startStream('cam-FallbackIdle');
    await vi.advanceTimersByTimeAsync(9_000);
    await promise;
    // Trigger the idle timer that was set inside the fallback branch
    await vi.advanceTimersByTimeAsync(61_000);
    expect(listActiveStreams().some((s) => s.cameraId === 'cam-FallbackIdle')).toBe(false);
  });

  it('stopStream tolerates fs.rm errors (best-effort cleanup)', async () => {
    rmMock.mockRejectedValueOnce(new Error('disk full'));

    onRun = (proc) => setTimeout(() => proc.emit('stderr', 'seg000.ts'), 5);
    const promise = startStream('cam-RmErr');
    await vi.advanceTimersByTimeAsync(50);
    await promise;

    await expect(stopStream('cam-RmErr')).resolves.toBeUndefined();
  });
});
