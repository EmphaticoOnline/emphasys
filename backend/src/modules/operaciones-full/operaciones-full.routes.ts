import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import { getEstadoFull, postCerrarFull } from './operaciones-full.controller';
const router = Router();
router.use(requireAuth, requireEmpresaActiva);
router.get('/documentos/:documentoId', getEstadoFull);
router.post('/documentos/:documentoId/cerrar', postCerrarFull);
export default router;
