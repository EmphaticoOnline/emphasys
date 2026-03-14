import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import {
  getAplicacionesPorOperacion,
  deleteAplicacion,
  deleteCuenta,
  deleteOperacion,
  deleteTransferencia,
  getAplicacionesPorDocumento,
  getCuentas,
  getEstadoCuentaContacto,
  getOperaciones,
  getReporteAging,
  getDisponibleOperacion,
  getOperacion,
  getReporteAgingResumen,
  getSaldoDocumento,
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

// Todas las rutas requieren autenticación y empresa activa
router.use(requireAuth, requireEmpresaActiva);

router.get('/documentos/:id/aplicaciones', getAplicacionesPorDocumento);
router.get('/documentos/:id/saldo', getSaldoDocumento);
router.get('/contactos/:id/estado-cuenta', getEstadoCuentaContacto);
router.get('/reportes/aging', getReporteAging);
router.get('/reportes/aging-resumen', getReporteAgingResumen);
router.get('/finanzas_operaciones/:id/disponible', getDisponibleOperacion);
router.get('/finanzas_operaciones/:id', getOperacion);
router.get('/finanzas_operaciones/:id/aplicaciones', getAplicacionesPorOperacion);

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
