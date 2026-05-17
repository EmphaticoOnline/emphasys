import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import { getPrecioDocumento, getPreciosCaptura, putPreciosBatch } from './precios.controller';

const router = Router();

router.get('/captura', requireAuth, requireEmpresaActiva, getPreciosCaptura);
router.put('/captura', requireAuth, requireEmpresaActiva, putPreciosBatch);
router.get('/resolver-documento', requireAuth, requireEmpresaActiva, getPrecioDocumento);

export default router;