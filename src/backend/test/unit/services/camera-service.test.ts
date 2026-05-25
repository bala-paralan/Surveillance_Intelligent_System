import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { prismaStub, resetPrismaStub } from '../../utils/prisma-stub.js';

vi.mock('../../../src/db.js', () => ({ prisma: prismaStub }));

type SockMock = EventEmitter & {
  destroy: () => void;
};
const sockets: SockMock[] = [];
let connectionFactory: (host: string, port: number) => SockMock;

vi.mock('net', () => ({
  createConnection: (
    opts: { host: string; port: number; timeout?: number },
    listener?: () => void,
  ) => {
    const sock = new EventEmitter() as SockMock;
    sock.destroy = () => undefined;
    sockets.push(sock);
    // Allow tests to drive behaviour
    setImmediate(() => connectionFactory(opts.host, opts.port).emit('__bind__', sock, listener));
    return sock;
  },
}));

const {
  createCamera,
  listCameras,
  getCameraById,
  updateCamera,
  deleteCamera,
  testCamera,
  getDecryptedRtspUrl,
} = await import('../../../src/services/camera-service.js');

const { encrypt } = await import('../../../src/crypto.js');

describe('services/camera-service', () => {
  beforeEach(() => {
    resetPrismaStub();
    sockets.length = 0;
    connectionFactory = () => {
      throw new Error('connectionFactory not set by test');
    };
  });

  afterEach(() => {
    sockets.forEach((s) => s.removeAllListeners());
  });

  it('createCamera encrypts rtsp, username, password and returns public shape', async () => {
    prismaStub.camera.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'c1',
      name: data['name'] as string,
      rtspUrlEncrypted: data['rtspUrlEncrypted'] as string,
      usernameEncrypted: data['usernameEncrypted'] as string | null,
      passwordEncrypted: data['passwordEncrypted'] as string | null,
      manufacturer: data['manufacturer'] as string | null,
      model: data['model'] as string | null,
      siteId: data['siteId'] as string | null,
      location: data['location'] as string | null,
      status: 'OFFLINE',
      lastSeenAt: null,
      createdBy: 'u',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
    }));

    const out = await createCamera(
      {
        name:     'Cam1',
        rtspUrl:  'rtsp://1.2.3.4/stream',
        username: 'u',
        password: 'p',
      },
      'u_creator'
    );
    expect(prismaStub.camera.create).toHaveBeenCalledOnce();
    const data = prismaStub.camera.create.mock.calls[0]![0].data;
    expect(data.rtspUrlEncrypted).not.toBe('rtsp://1.2.3.4/stream');
    expect(typeof data.usernameEncrypted).toBe('string');
    expect(typeof data.passwordEncrypted).toBe('string');
    expect(out).not.toHaveProperty('rtspUrlEncrypted');
    expect(out.name).toBe('Cam1');
  });

  it('createCamera handles optional fields → null encryption', async () => {
    prismaStub.camera.create.mockResolvedValue({
      id: 'c2',
      name: 'A',
      manufacturer: null,
      model: null,
      siteId: null,
      location: null,
      status: 'OFFLINE',
      lastSeenAt: null,
      createdBy: 'u',
      createdAt: new Date(),
      updatedAt: new Date(),
      rtspUrlEncrypted: 'x',
      usernameEncrypted: null,
      passwordEncrypted: null,
    });
    await createCamera({ name: 'A', rtspUrl: 'rtsp://h/s' }, 'u');
    const data = prismaStub.camera.create.mock.calls[0]![0].data;
    expect(data.usernameEncrypted).toBeNull();
    expect(data.passwordEncrypted).toBeNull();
  });

  it('listCameras returns count and pagination', async () => {
    prismaStub.camera.count.mockResolvedValue(2);
    prismaStub.camera.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    const out = await listCameras({ page: 1, limit: 50 });
    expect(out).toEqual({ total: 2, page: 1, limit: 50, count: 2, cameras: [{ id: 'a' }, { id: 'b' }] });
  });

  it('getCameraById returns the public shape', async () => {
    prismaStub.camera.findUnique.mockResolvedValue({
      id: 'c1',
      name: 'A',
      manufacturer: null,
      model: null,
      siteId: null,
      location: null,
      status: 'OFFLINE',
      lastSeenAt: null,
      createdBy: 'u',
      createdAt: new Date(),
      updatedAt: new Date(),
      rtspUrlEncrypted: 'x',
      usernameEncrypted: null,
      passwordEncrypted: null,
    });
    const out = await getCameraById('c1');
    expect(out.id).toBe('c1');
    expect(out).not.toHaveProperty('rtspUrlEncrypted');
  });

  it('getCameraById → 404 when not found', async () => {
    prismaStub.camera.findUnique.mockResolvedValue(null);
    await expect(getCameraById('missing')).rejects.toThrow(/Camera not found/);
  });

  it('updateCamera applies partial updates and encrypts changed credentials', async () => {
    prismaStub.camera.findUnique.mockResolvedValue({ id: 'c1' });
    prismaStub.camera.update.mockResolvedValue({
      id: 'c1', name: 'New', manufacturer: 'M', model: 'X', siteId: 's', location: 'loc',
      status: 'OFFLINE', lastSeenAt: null, createdBy: 'u',
      createdAt: new Date(), updatedAt: new Date(),
    });
    const out = await updateCamera('c1', {
      name: 'New', rtspUrl: 'rtsp://x/y', username: 'a', password: 'b',
      manufacturer: 'M', model: 'X', siteId: 's', location: 'loc',
    });
    expect(out.id).toBe('c1');
    const data = prismaStub.camera.update.mock.calls[0]![0].data;
    expect(data.rtspUrlEncrypted).toMatch(/:/);
    expect(data.usernameEncrypted).toMatch(/:/);
  });

  it('updateCamera no-op when all fields omitted', async () => {
    prismaStub.camera.findUnique.mockResolvedValue({ id: 'c1' });
    prismaStub.camera.update.mockResolvedValue({
      id: 'c1', name: 'X', manufacturer: null, model: null, siteId: null, location: null,
      status: 'OFFLINE', lastSeenAt: null, createdBy: 'u',
      createdAt: new Date(), updatedAt: new Date(),
    });
    await updateCamera('c1', {});
    expect(prismaStub.camera.update.mock.calls[0]![0].data).toEqual({});
  });

  it('updateCamera throws if camera missing', async () => {
    prismaStub.camera.findUnique.mockResolvedValue(null);
    await expect(updateCamera('c1', { name: 'X' })).rejects.toThrow(/Camera not found/);
  });

  it('deleteCamera throws if missing, else deletes', async () => {
    prismaStub.camera.findUnique.mockResolvedValue(null);
    await expect(deleteCamera('c1')).rejects.toThrow(/Camera not found/);

    prismaStub.camera.findUnique.mockResolvedValue({ id: 'c1' });
    prismaStub.camera.delete.mockResolvedValue({ id: 'c1' });
    await expect(deleteCamera('c1')).resolves.toBeUndefined();
  });

  it('getDecryptedRtspUrl embeds username/password when present', async () => {
    prismaStub.camera.findUnique.mockResolvedValue({
      id: 'c1',
      rtspUrlEncrypted: encrypt('rtsp://1.2.3.4:554/s'),
      usernameEncrypted: encrypt('user'),
      passwordEncrypted: encrypt('pa ss'),
    });
    const url = await getDecryptedRtspUrl('c1');
    expect(url).toContain('user:');
    expect(url).toContain('1.2.3.4');
  });

  it('getDecryptedRtspUrl returns raw URL when no credentials', async () => {
    prismaStub.camera.findUnique.mockResolvedValue({
      id: 'c1',
      rtspUrlEncrypted: encrypt('rtsp://1.2.3.4:554/s'),
      usernameEncrypted: null,
      passwordEncrypted: null,
    });
    expect(await getDecryptedRtspUrl('c1')).toBe('rtsp://1.2.3.4:554/s');
  });

  it('getDecryptedRtspUrl throws when camera not found', async () => {
    prismaStub.camera.findUnique.mockResolvedValue(null);
    await expect(getDecryptedRtspUrl('c1')).rejects.toThrow(/Camera not found/);
  });

  it('testCamera resolves reachable on successful TCP connect', async () => {
    prismaStub.camera.findUnique.mockResolvedValue({
      id: 'c1',
      rtspUrlEncrypted: encrypt('rtsp://1.2.3.4:554/stream'),
      usernameEncrypted: null,
      passwordEncrypted: null,
    });
    connectionFactory = () => {
      const bridge = new EventEmitter();
      bridge.on('__bind__', (sock: SockMock, listener?: () => void) => {
        listener?.();
      });
      return bridge as unknown as SockMock;
    };
    const result = await testCamera('c1');
    expect(result.reachable).toBe(true);
    expect(result.latency_ms).toBeGreaterThanOrEqual(0);
    expect(result.message).toMatch(/1\.2\.3\.4/);
  });

  it('testCamera resolves unreachable on connect error', async () => {
    prismaStub.camera.findUnique.mockResolvedValue({
      id: 'c1',
      rtspUrlEncrypted: encrypt('rtsp://1.2.3.4/stream'),
      usernameEncrypted: null,
      passwordEncrypted: null,
    });
    connectionFactory = () => {
      const bridge = new EventEmitter();
      bridge.on('__bind__', (sock: SockMock) => {
        sock.emit('error', new Error('ECONNREFUSED'));
      });
      return bridge as unknown as SockMock;
    };
    const result = await testCamera('c1');
    expect(result.reachable).toBe(false);
    expect(result.message).toBe('ECONNREFUSED');
    expect(result.latency_ms).toBeNull();
  });

  it('testCamera resolves unreachable on timeout', async () => {
    prismaStub.camera.findUnique.mockResolvedValue({
      id: 'c1',
      rtspUrlEncrypted: encrypt('rtsp://1.2.3.4/stream'),
      usernameEncrypted: null,
      passwordEncrypted: null,
    });
    connectionFactory = () => {
      const bridge = new EventEmitter();
      bridge.on('__bind__', (sock: SockMock) => {
        sock.emit('timeout');
      });
      return bridge as unknown as SockMock;
    };
    const result = await testCamera('c1');
    expect(result.reachable).toBe(false);
    expect(result.message).toMatch(/timed out/i);
  });

  it('testCamera throws when camera missing', async () => {
    prismaStub.camera.findUnique.mockResolvedValue(null);
    await expect(testCamera('nope')).rejects.toThrow(/Camera not found/);
  });
});
