import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../auth/auth.middleware';
import { registrarCsdEmpresaFacturamaController } from './cfdi-csd.controller';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const manejarUploadCsd = (req: Request, res: Response, next: NextFunction) => {
  const handler = upload.fields([
    { name: 'cer', maxCount: 1 },
    { name: 'key', maxCount: 1 },
    { name: 'archivo_cer', maxCount: 1 },
    { name: 'archivo_key', maxCount: 1 },
  ]);

  handler(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Los archivos CSD no deben exceder 5MB' });
      }

      return res.status(400).json({ message: err.message });
    }

    if (err) {
      return next(err);
    }

    return next();
  });
};

router.post('/empresas/:empresaId/csd', requireAuth, manejarUploadCsd, registrarCsdEmpresaFacturamaController);

export default router;
