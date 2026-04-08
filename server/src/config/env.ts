import { config } from 'dotenv';
import { z } from 'zod';

config();

const splitCsv = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().default('http://localhost:5000'),
  FRONTEND_URL: z.string().url().default('http://localhost:5000'),
  APP_BASE_URL: z.string().url().default('http://localhost:4000'),
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(5),
  SERVE_FRONTEND: z
    .string()
    .transform((v) => v === 'true' || v === '1')
    .default('false'),
  FRONTEND_DIST_PATH: z.string().default('client/dist'),
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  corsOrigins: splitCsv(parsed.CORS_ORIGIN),
  maxUploadBytes: Math.floor(parsed.MAX_UPLOAD_MB * 1024 * 1024),
};
