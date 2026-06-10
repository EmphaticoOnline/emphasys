import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import {
  postMovimientoManual,
  postAplicarDocumento,
  postRevertirDocumento,
  getMovimientos,
  getMovimientoDetalle,
  exportarMovimientos,
} from './inventario.controller';

const router = Router();

router.use(requireAuth, requireEmpresaActiva);

router.post('/movimientos/exportar', exportarMovimientos);
router.post('/movimientos/manual', postMovimientoManual);
router.post('/documentos/:id/aplicar', postAplicarDocumento);
router.post('/documentos/:id/revertir', postRevertirDocumento);
router.get('/movimientos/:id', getMovimientoDetalle);
router.get('/movimientos', getMovimientos); // opcional/no implementado

export default router;
