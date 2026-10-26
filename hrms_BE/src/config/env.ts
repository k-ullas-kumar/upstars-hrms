import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config();

const DEV_JWT_SECRET = 'dev-only-insecure-secret-change-me-please-0123456789';

const rawSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5001),
  DATABASE_URL: z.string().optional(),
  DATABASE_SSL: z.string().optional(),
  SQLITE_PATH: z.string().default('./data/hrms.sqlite'),
  JWT_SECRET: z.string().optional(),
  JWT_EXPIRES_IN: z.string().default('7d'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  STORAGE_DIR: z.string().default('./uploads'),
  RESET_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(60),
});

/** True when the URL is empty or obviously an unedited template value. */
export function isPlaceholderDatabaseUrl(url: string | undefined): boolean {
  if (!url) return true;
  const trimmed = url.trim();
  if (!trimmed) return true;
  const lowered = trimmed.toLowerCase();
  if (!/^postgres(ql)?:\/\//.test(lowered)) return true;
  const markers = [':password@', ':pass@', ':changeme@', ':yourpassword@', 'your_', '<', '>', 'user:pass@'];
  return markers.some((m) => lowered.includes(m));
}

const parsed = rawSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
}
const raw = parsed.data;

const isProduction = raw.NODE_ENV === 'production';
let jwtSecret = raw.JWT_SECRET;
const secretIsWeak = !jwtSecret || jwtSecret.length < 32 || jwtSecret.startsWith('change-me');
if (secretIsWeak) {
  if (isProduction) {
    throw new Error('JWT_SECRET must be set to a random string of at least 32 characters in production');
  }
  jwtSecret = DEV_JWT_SECRET;
}

export const env = {
  nodeEnv: raw.NODE_ENV,
  isProduction,
  isTest: raw.NODE_ENV === 'test',
  port: raw.PORT,
  databaseUrl: isPlaceholderDatabaseUrl(raw.DATABASE_URL) ? null : (raw.DATABASE_URL as string).trim(),
  databaseSsl: raw.DATABASE_SSL === 'true',
  sqlitePath: raw.SQLITE_PATH,
  jwtSecret: jwtSecret as string,
  jwtExpiresIn: raw.JWT_EXPIRES_IN,
  frontendOrigins: raw.FRONTEND_URL.split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  storageDir: path.resolve(process.cwd(), raw.STORAGE_DIR),
  resetTokenTtlMinutes: raw.RESET_TOKEN_TTL_MINUTES,
};

export type Env = typeof env;
