import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/api-response.js';
import { toPublicUploadUrl } from './service.js';

export async function uploadDevicePhotosController(req: Request, res: Response) {
  const files = (req.files ?? []) as Express.Multer.File[];

  return sendSuccess(
    res,
    'Archivos cargados correctamente',
    files.map((file) => ({
      original_name: file.originalname,
      filename: file.filename,
      mime_type: file.mimetype,
      size: file.size,
      url: toPublicUploadUrl(file.path),
    })),
    201,
  );
}
