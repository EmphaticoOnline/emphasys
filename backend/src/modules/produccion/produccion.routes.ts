import { Router } from 'express';
import { requireAdministradorProduccion, requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
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
router.post('/etapas', requireAdministradorProduccion, postEtapaProduccion);
router.put('/etapas/:id', requireAdministradorProduccion, putEtapaProduccion);
router.delete('/etapas/:id', requireAdministradorProduccion, deleteEtapaProduccion);
router.get('/seguimientos', getSeguimientosProduccion);
router.get('/seguimientos/documento/:documentoId', getSeguimientoProduccionPorDocumento);
router.get('/documentos/:documentoId/detalle', getDetalleOperativoProduccion);
router.post('/seguimientos', postSeguimientoProduccion);
router.put('/seguimientos/:id', putSeguimientoProduccion);

export default router;