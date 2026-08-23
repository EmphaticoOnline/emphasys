import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import { getCartaPorte, getViaje, postValidarCartaPorte, postViaje, putViaje, putViajeDocumento } from './transporte.controller';

const router = Router();

router.use(requireAuth, requireEmpresaActiva);
router.post('/viajes', postViaje);
router.get('/viajes/:id', getViaje);
router.put('/viajes/:id', putViaje);
router.post('/viajes/:id/validar-carta-porte', postValidarCartaPorte);
router.get('/viajes/:id/carta-porte', getCartaPorte);
router.put('/viajes/:id/documento', putViajeDocumento);

export default router;
