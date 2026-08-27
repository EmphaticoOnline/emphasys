import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import { getPrecioBaseComercial, putPrecioBaseComercial } from './precios-base-comerciales.controller';
const router = Router();
router.use(requireAuth, requireEmpresaActiva);
router.get('/partidas/:partidaId', getPrecioBaseComercial);
router.put('/documentos/:documentoId/partidas/:partidaId', putPrecioBaseComercial);
export default router;
