import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import { obtenerTiposDocumento, obtenerTiposDocumentoEmpresa } from './tipos-documento.controller';

const router = Router();

router.get('/', requireAuth, requireEmpresaActiva, obtenerTiposDocumento);
router.get('/habilitados', requireAuth, requireEmpresaActiva, obtenerTiposDocumentoEmpresa);

export default router;
