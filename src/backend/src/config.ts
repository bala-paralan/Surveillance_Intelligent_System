import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL:          z.string().url(),
  JWT_ACCESS_SECRET:     z.string().min(16),
  JWT_REFRESH_SECRET:    z.string().min(16),
  JWT_ACCESS_TTL:        z.coerce.number().default(900),
  JWT_REFRESH_TTL:       z.coerce.number().default(604800),
  ENCRYPTION_KEY:        z.string().length(64, 'ENCRYPTION_KEY must be 64 hex chars (32 bytes)'),
  PORT:                  z.coerce.number().default(3001),
  HOST:                  z.string().default('0.0.0.0'),
  LOG_LEVEL:             z.string().default('info'),
  CORS_ORIGINS:          z.string().default('http://localhost:3000,http://localhost:5173'),
  HLS_DIR:               z.string().default('/tmp/surveillanceos/streams'),
  STREAM_IDLE_TIMEOUT_S: z.coerce.number().default(300),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌  Invalid environment variables:\n', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export const corsOrigins = config.CORS_ORIGINS.split(',').map((s) => s.trim());
