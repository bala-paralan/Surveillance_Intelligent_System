/**
 * Vitest globalSetup: populate process.env BEFORE any module imports config.ts.
 * Imported via vitest.config.ts → setupFiles, which runs before each test file.
 */
process.env['DATABASE_URL'] = process.env['DATABASE_URL'] ?? 'postgresql://test:test@localhost:5432/sis_test';
process.env['REDIS_URL'] = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
process.env['JWT_ACCESS_SECRET'] = process.env['JWT_ACCESS_SECRET'] ?? 'test-access-secret-at-least-16-chars';
process.env['JWT_REFRESH_SECRET'] = process.env['JWT_REFRESH_SECRET'] ?? 'test-refresh-secret-at-least-16-chars';
process.env['JWT_ACCESS_TTL'] = process.env['JWT_ACCESS_TTL'] ?? '900';
process.env['JWT_REFRESH_TTL'] = process.env['JWT_REFRESH_TTL'] ?? '604800';
process.env['ENCRYPTION_KEY'] =
  process.env['ENCRYPTION_KEY'] ??
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env['PORT'] = process.env['PORT'] ?? '3001';
process.env['LOG_LEVEL'] = process.env['LOG_LEVEL'] ?? 'silent';
process.env['CORS_ORIGINS'] = process.env['CORS_ORIGINS'] ?? 'http://localhost:3000';
process.env['HLS_DIR'] = process.env['HLS_DIR'] ?? '/tmp/sis-test-streams';
process.env['STREAM_IDLE_TIMEOUT_S'] = process.env['STREAM_IDLE_TIMEOUT_S'] ?? '300';
