/**
 * Prisma seed — creates the default admin user if not present.
 * Run: npx tsx prisma/seed.ts
 */
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ADMIN_EMAIL    = process.env['SEED_ADMIN_EMAIL']    ?? 'admin@surveillance.local';
const ADMIN_PASSWORD = process.env['SEED_ADMIN_PASSWORD'] ?? 'ChangeMe123!';
const ADMIN_NAME     = process.env['SEED_ADMIN_NAME']     ?? 'System Admin';

async function main(): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existing) {
    console.log(`Admin user already exists: ${ADMIN_EMAIL}`);
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const user = await prisma.user.create({
    data: {
      email:       ADMIN_EMAIL,
      passwordHash,
      displayName: ADMIN_NAME,
      role:        'ADMIN',
      active:      true,
    },
  });
  console.log(`Created admin user: ${user.email} (id: ${user.id})`);
  console.log('⚠️  Change the default password immediately in production!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => void prisma.$disconnect());
