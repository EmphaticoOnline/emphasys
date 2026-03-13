import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import {
  deleteAplicacion,
  deleteCuenta,
  deleteOperacion,
  deleteTransferencia,
  getCuentas,
  getOperaciones,
  postAplicacion,
  postConciliacion,
  postCuenta,
  postOperacion,
  postTransferencia,
  putCuenta,
  putOperacion,
  putTransferencia,
} from './finanzas.controller';

const router = Router();

router.use(requireAuth, requireEmpresaActiva);

router.get('/cuentas', getCuentas);
router.post('/cuentas', postCuenta);
router.put('/cuentas/:id', putCuenta);
router.delete('/cuentas/:id', deleteCuenta);

router.get('/operaciones', getOperaciones);
router.post('/operaciones', postOperacion);
router.put('/operaciones/:id', putOperacion);
router.delete('/operaciones/:id', deleteOperacion);

router.post('/transferencias', postTransferencia);
router.put('/transferencias/:id', putTransferencia);
router.delete('/transferencias/:id', deleteTransferencia);
router.post('/conciliaciones', postConciliacion);

router.post('/aplicaciones', postAplicacion);
router.delete('/aplicaciones/:id', deleteAplicacion);

export default router;
