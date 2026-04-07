import crypto from 'node:crypto';
import path from 'node:path';
import type { Request } from 'express';
import multer from 'multer';
import { env } from '../../config/env.js';
import { HttpError } from '../../utils/http-error.js';
import { ensureDirectoryExists, resolveFromRepo } from '../../utils/paths.js';

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function buildDeviceUploadsDir(deviceId: string) {
  const safeDeviceId = deviceId.replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(resolveFromRepo(env.UPLOAD_DIR), 'devices', safeDeviceId);
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const deviceId = String(req.params.deviceId ?? '').trim();
    if (!/^\d+$/.test(deviceId)) {
      cb(new HttpError(400, 'El parámetro deviceId debe ser numérico.') as unknown as Error, '');
      return;
    }

    const destination = buildDeviceUploadsDir(deviceId);
    ensureDirectoryExists(destination);
    cb(null, destination);
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safeExtension = ['.jpg', '.jpeg', '.png', '.webp'].includes(extension) ? extension : '.jpg';
    cb(null, `${Date.now()}-${crypto.randomUUID()}${safeExtension}`);
  },
});

function fileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (!allowedMimeTypes.has(file.mimetype)) {
    cb(new HttpError(400, 'Tipo de archivo no permitido. Usa JPG, PNG o WEBP.') as unknown as Error);
    return;
  }
  cb(null, true);
}

export const uploadDevicePhoto = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.maxUploadBytes,
    files: 5,
  },
});

export function toPublicUploadUrl(filePath: string) {
  const uploadRoot = resolveFromRepo(env.UPLOAD_DIR);
  const normalized = path.relative(uploadRoot, filePath).replace(/\\/g, '/');
  return `/uploads/${normalized}`;
}
