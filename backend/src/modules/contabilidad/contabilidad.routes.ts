import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import {
  getCuentas,
  getCuenta,
  postCuenta,
  putCuenta,
  patchCuentaEstado,
  getValidarNuevaCuenta,
} from './cuentas.controller';
import { getConfiguracion, putConfiguracion } from './configuracion.controller';

const router = Router();

router.use(requireAuth, requireEmpresaActiva);

router.get('/cuentas/validar-nueva', getValidarNuevaCuenta);
router.get('/cuentas', getCuentas);
router.get('/cuentas/:id', getCuenta);
router.post('/cuentas', postCuenta);
router.put('/cuentas/:id', putCuenta);
router.patch('/cuentas/:id/estado', patchCuentaEstado);

router.get('/configuracion', getConfiguracion);
router.put('/configuracion', putConfiguracion);

export default router;
