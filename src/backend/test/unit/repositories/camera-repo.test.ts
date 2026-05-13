import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismaStub, resetPrismaStub } from '../../utils/prisma-stub.js';

vi.mock('../../../src/db.js', () => ({ prisma: prismaStub }));

const { cameraRepo } = await import('../../../src/repositories/camera-repo.js');

describe('repositories/camera-repo', () => {
  beforeEach(() => resetPrismaStub());

  it('create delegates to prisma.camera.create', async () => {
    prismaStub.camera.create.mockResolvedValue({ id: 'c1' });
    const row = await cameraRepo.create({ name: 'Cam' } as never);
    expect(prismaStub.camera.create).toHaveBeenCalledWith({ data: { name: 'Cam' } });
    expect(row).toEqual({ id: 'c1' });
  });

  it('findById delegates with where clause', async () => {
    prismaStub.camera.findUnique.mockResolvedValue(null);
    expect(await cameraRepo.findById('c1')).toBeNull();
    expect(prismaStub.camera.findUnique).toHaveBeenCalledWith({ where: { id: 'c1' } });
  });

  it('list returns { total, page, limit, rows } and applies filters/pagination', async () => {
    prismaStub.camera.count.mockResolvedValue(42);
    prismaStub.camera.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    const out = await cameraRepo.list({ siteId: 'site1', status: 'ONLINE', page: 2, limit: 10 });
    expect(out).toEqual({ total: 42, page: 2, limit: 10, rows: [{ id: 'a' }, { id: 'b' }] });

    const where = { siteId: 'site1', status: 'ONLINE' };
    expect(prismaStub.camera.count).toHaveBeenCalledWith({ where });
    expect(prismaStub.camera.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where, skip: 10, take: 10 }),
    );
  });

  it('list uses default page/limit and empty filters', async () => {
    prismaStub.camera.count.mockResolvedValue(0);
    prismaStub.camera.findMany.mockResolvedValue([]);
    const out = await cameraRepo.list();
    expect(out).toEqual({ total: 0, page: 1, limit: 50, rows: [] });
  });

  it('update delegates with where + data', async () => {
    prismaStub.camera.update.mockResolvedValue({ id: 'c1', name: 'X' });
    const out = await cameraRepo.update('c1', { name: 'X' } as never);
    expect(prismaStub.camera.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { name: 'X' } });
    expect(out).toEqual({ id: 'c1', name: 'X' });
  });

  it('delete resolves to undefined', async () => {
    prismaStub.camera.delete.mockResolvedValue({ id: 'c1' });
    await expect(cameraRepo.delete('c1')).resolves.toBeUndefined();
  });

  it('updateStatus with lastSeenAt sets both', async () => {
    prismaStub.camera.update.mockResolvedValue({});
    const ts = new Date();
    await cameraRepo.updateStatus('c1', 'ONLINE', ts);
    expect(prismaStub.camera.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { status: 'ONLINE', lastSeenAt: ts },
    });
  });

  it('updateStatus without lastSeenAt only sets status', async () => {
    prismaStub.camera.update.mockResolvedValue({});
    await cameraRepo.updateStatus('c1', 'OFFLINE');
    expect(prismaStub.camera.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { status: 'OFFLINE' },
    });
  });
});
