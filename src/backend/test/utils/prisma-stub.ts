/**
 * Helpers for vi.mock'ing the prisma client.
 *
 * Usage:
 *   vi.mock('../../src/db.js', () => ({ prisma: prismaStub }));
 *
 * Each model's CRUD functions return what you've set with `mockResolvedValueOnce`
 * or `mockReturnValueOnce`. Tests can also reach into `prismaStub.<model>.<fn>`
 * to inspect calls.
 */
import { vi } from 'vitest';

type AnyFn = ReturnType<typeof vi.fn>;

const model = () => ({
  create:     vi.fn() as AnyFn,
  createMany: vi.fn() as AnyFn,
  findUnique: vi.fn() as AnyFn,
  findMany:   vi.fn() as AnyFn,
  findFirst:  vi.fn() as AnyFn,
  update:     vi.fn() as AnyFn,
  upsert:     vi.fn() as AnyFn,
  delete:     vi.fn() as AnyFn,
  deleteMany: vi.fn() as AnyFn,
  count:      vi.fn() as AnyFn,
});

export const prismaStub = {
  user:               model(),
  refreshToken:       model(),
  camera:             model(),
  bop:                model(),
  bopZone:            model(),
  asset:              model(),
  gisSyncLog:         model(),
  sensor:             model(),
  cameraZone:         model(),
  alert:              model(),
  recordingSchedule:  model(),
  recording:          model(),
  sensorEvent:        model(),
  fusionOutcome:      model(),
  fusionWeight:       model(),
  aoi:                model(),
  $transaction: vi.fn((cb: unknown) => {
    if (typeof cb === 'function') {
      return (cb as (tx: typeof prismaStub) => unknown)(prismaStub);
    }
    return Promise.all(cb as Array<Promise<unknown>>);
  }),
  $on: vi.fn(),
};

/** Reset all mock state on every stub method — call from `beforeEach`. */
export const resetPrismaStub = (): void => {
  for (const m of Object.values(prismaStub)) {
    if (m && typeof m === 'object') {
      for (const fn of Object.values(m)) {
        if (typeof fn === 'function' && 'mockReset' in fn) {
          (fn as AnyFn).mockReset();
        }
      }
    }
  }
  prismaStub.$transaction.mockReset();
  prismaStub.$transaction.mockImplementation((cb: unknown) => {
    if (typeof cb === 'function') {
      return (cb as (tx: typeof prismaStub) => unknown)(prismaStub);
    }
    return Promise.all(cb as Array<Promise<unknown>>);
  });
};
