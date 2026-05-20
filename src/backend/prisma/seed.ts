/**
 * Prisma seed — provisions one user per role (ADMIN, OPERATOR, VIEWER).
 * Run: npx tsx prisma/seed.ts
 */
import bcrypt from 'bcryptjs';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

interface SeedUser {
  email:       string;
  password:    string;
  displayName: string;
  role:        Role;
}

const seedUsers: SeedUser[] = [
  {
    email:       process.env['SEED_ADMIN_EMAIL']    ?? 'admin@surveillance.local',
    password:    process.env['SEED_ADMIN_PASSWORD'] ?? 'ChangeMe123!',
    displayName: process.env['SEED_ADMIN_NAME']     ?? 'System Admin',
    role:        Role.ADMIN,
  },
  {
    email:       process.env['SEED_OPERATOR_EMAIL']    ?? 'operator@surveillance.local',
    password:    process.env['SEED_OPERATOR_PASSWORD'] ?? 'OperatorPass123!',
    displayName: process.env['SEED_OPERATOR_NAME']     ?? 'Default Operator',
    role:        Role.OPERATOR,
  },
  {
    email:       process.env['SEED_VIEWER_EMAIL']    ?? 'viewer@surveillance.local',
    password:    process.env['SEED_VIEWER_PASSWORD'] ?? 'ViewerPass123!',
    displayName: process.env['SEED_VIEWER_NAME']     ?? 'Default Viewer',
    role:        Role.VIEWER,
  },
];

const upsertUser = async ({ email, password, displayName, role }: SeedUser): Promise<void> => {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`User already exists: ${email} (${role})`);
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, displayName, role, active: true },
  });
  console.log(`Created ${role} user: ${user.email} (id: ${user.id})`);
};

const main = async (): Promise<void> => {
  for (const u of seedUsers) {
    await upsertUser(u);
  }
  console.log('⚠️  Change default passwords immediately in production!');
};

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => void prisma.$disconnect());
