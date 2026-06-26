import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import {
  deleteAplicacion,
  deleteCuenta,
  deleteOperacion,
  deleteTransferencia,
  getAnticiposDisponiblesDocumento,
  getAplicacionesPorDocumento,
  getCuentas,
  getDiagnosticoDuplicados,
  getEstadoCuentaContacto,
  getOperaciones,
  getReporteAging,
  getOperacion,
  getReporteAgingResumen,
  getResumenAnticiposDocumento,
  getSaldoDocumento,
  getVerificacionSaldos,
  postAplicarAnticiposDocumento,
  postAplicacion,
  postConciliacion,
  postCuenta,
  postOperacion,
  postTransferencia,
  putCuenta,
  putOperacion,
  putTransferencia,
  getMetodosPago,
  postMetodoPago,
  putMetodoPago,
  getFacturasCompraPendientes,
  getProgramacionesPago,
  postProgramacionPago,
  putProgramacionPago,
  postCancelarProgramacion,
  postPagarProgramacion,
  getConciliacionMovimientos,
  postCotejarMovimientos,
  postCerrarConciliacion,
  getHistorialConciliaciones,
  postDeshacerConciliacion,
} from './finanzas.controller';

const router = Router();

// Todas las rutas requieren autenticación y empresa activa
router.use(requireAuth, requireEmpresaActiva);

router.get('/documentos/:id/aplicaciones', getAplicacionesPorDocumento);
router.get('/documentos/:id/saldo', getSaldoDocumento);
router.get('/documentos/:id/anticipos-resumen', getResumenAnticiposDocumento);
router.get('/documentos/:id/anticipos-disponibles', getAnticiposDisponiblesDocumento);
router.post('/documentos/:id/aplicar-anticipos', postAplicarAnticiposDocumento);
router.get('/contactos/:id/estado-cuenta', getEstadoCuentaContacto);
router.get('/reportes/aging', getReporteAging);
router.get('/reportes/aging-resumen', getReporteAgingResumen);
router.get('/finanzas_operaciones/:id', getOperacion);

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

// Endpoints de diagnóstico (solo lectura, no modifican datos)
router.get('/diagnostico/saldos', getVerificacionSaldos);
router.get('/diagnostico/duplicados-aplicaciones', getDiagnosticoDuplicados);

// Catálogo de métodos de pago operativos
router.get('/metodos-pago',     getMetodosPago);
router.post('/metodos-pago',    postMetodoPago);
router.put('/metodos-pago/:id', putMetodoPago);

// Programación de pagos a proveedores (Fase 3.2A)
router.get('/facturas-compra-pendientes',              getFacturasCompraPendientes);
router.get('/programacion-pagos',                      getProgramacionesPago);
router.post('/programacion-pagos',                     postProgramacionPago);
router.put('/programacion-pagos/:id',                  putProgramacionPago);
router.post('/programacion-pagos/:id/cancelar',        postCancelarProgramacion);
router.post('/programacion-pagos/:id/pagar',           postPagarProgramacion);

// Conciliación bancaria básica (Fase 3.4)
router.get('/conciliacion-bancaria/movimientos', getConciliacionMovimientos);
router.post('/conciliacion-bancaria/cotejar',    postCotejarMovimientos);
router.post('/conciliacion-bancaria/cerrar',     postCerrarConciliacion);
router.get('/conciliacion-bancaria/historial',   getHistorialConciliaciones);
router.post('/conciliacion-bancaria/:id/deshacer', postDeshacerConciliacion);

export default router;
