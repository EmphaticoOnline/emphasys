import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import { obtenerTiposDocumento } from './tipos-documento.controller';

const router = Router();

router.get('/', requireAuth, requireEmpresaActiva, obtenerTiposDocumento);

export default router;
