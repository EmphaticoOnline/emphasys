import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import { getCartaPorte, getCartaPortePDF, getViaje, getOperadoresDisponibles, getPartidasImportables, getUbicacionesDisponibles, getViajeDeDocumento, postValidarCartaPorte, postViaje, postViajeDeDocumento, putViaje, putViajeDocumento } from './transporte.controller';

const router = Router();

router.use(requireAuth, requireEmpresaActiva);
router.get('/documentos/:documentoId/viaje', getViajeDeDocumento);
router.get('/documentos/:documentoId/carta-porte/pdf', getCartaPortePDF);
router.post('/documentos/:documentoId/viaje', postViajeDeDocumento);
router.get('/documentos/:documentoId/partidas-importables', getPartidasImportables);
router.get('/ubicaciones-disponibles', getUbicacionesDisponibles);
router.get('/operadores-disponibles', getOperadoresDisponibles);
router.post('/viajes', postViaje);
router.get('/viajes/:id', getViaje);
router.put('/viajes/:id', putViaje);
router.post('/viajes/:id/validar-carta-porte', postValidarCartaPorte);
router.get('/viajes/:id/carta-porte', getCartaPorte);
router.put('/viajes/:id/documento', putViajeDocumento);

export default router;
