/**
 * Camera repository — thin Prisma wrapper.
 * All crypto happens in camera-service, not here.
 */
import type { CameraStatus, Prisma } from '@prisma/client';
import { prisma } from '../db.js';

export interface CameraRow {
  id:                string;
  name:              string;
  rtspUrlEncrypted:  string;
  usernameEncrypted: string | null;
  passwordEncrypted: string | null;
  manufacturer:      string | null;
  model:             string | null;
  siteId:            string | null;
  location:          string | null;
  status:            CameraStatus;
  lastSeenAt:        Date | null;
  createdBy:         string;
  createdAt:         Date;
  updatedAt:         Date;
}

export interface ListFilters {
  siteId?: string;
  status?: CameraStatus;
  page?:   number;
  limit?:  number;
}

export const cameraRepo = {
  create: (data: Prisma.CameraCreateInput): Promise<CameraRow> =>
    prisma.camera.create({ data }) as Promise<CameraRow>,

  findById: (id: string): Promise<CameraRow | null> =>
    prisma.camera.findUnique({ where: { id } }) as Promise<CameraRow | null>,

  list: async ({ siteId, status, page = 1, limit = 50 }: ListFilters = {}) => {
    const where: Prisma.CameraWhereInput = {
      ...(siteId && { siteId }),
      ...(status && { status }),
    };
    const [total, rows] = await Promise.all([
      prisma.camera.count({ where }),
      prisma.camera.findMany({
        where,
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, manufacturer: true, model: true,
          siteId: true, location: true, status: true,
          lastSeenAt: true, createdAt: true, updatedAt: true, createdBy: true,
          // Encrypted fields intentionally excluded from list view
          rtspUrlEncrypted: false, usernameEncrypted: false, passwordEncrypted: false,
        },
      }),
    ]);
    return { total, page, limit, rows };
  },

  update: (id: string, data: Prisma.CameraUpdateInput): Promise<CameraRow> =>
    prisma.camera.update({ where: { id }, data }) as Promise<CameraRow>,

  delete: (id: string): Promise<void> =>
    prisma.camera.delete({ where: { id } }).then(() => undefined),

  updateStatus: (id: string, status: CameraStatus, lastSeenAt?: Date) =>
    prisma.camera.update({
      where: { id },
      data:  { status, ...(lastSeenAt && { lastSeenAt }) },
    }),
};
