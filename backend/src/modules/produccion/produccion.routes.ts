import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import {
  deleteEtapaProduccion,
  getDetalleOperativoProduccion,
  getEtapasProduccion,
  getSeguimientoProduccionPorDocumento,
  getSeguimientosProduccion,
  postEtapaProduccion,
  postSeguimientoProduccion,
  putEtapaProduccion,
  putSeguimientoProduccion,
} from './produccion.controller';

const router = Router();

router.use(requireAuth, requireEmpresaActiva);

router.get('/etapas', getEtapasProduccion);
router.post('/etapas', postEtapaProduccion);
router.put('/etapas/:id', putEtapaProduccion);
router.delete('/etapas/:id', deleteEtapaProduccion);
router.get('/seguimientos', getSeguimientosProduccion);
router.get('/seguimientos/documento/:documentoId', getSeguimientoProduccionPorDocumento);
router.get('/documentos/:documentoId/detalle', getDetalleOperativoProduccion);
router.post('/seguimientos', postSeguimientoProduccion);
router.put('/seguimientos/:id', putSeguimientoProduccion);

export default router;