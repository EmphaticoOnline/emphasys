import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import {
  getCuentas,
  getCuenta,
  postCuenta,
  putCuenta,
  patchCuentaEstado,
  getValidarNuevaCuenta,
  deleteCuenta,
  getCuentasAfectables,
  patchCuentaCodigoAgrupadorSat,
  patchCuentasCodigoAgrupadorSatLote,
} from './cuentas.controller';
import { getConfiguracion, putConfiguracion } from './configuracion.controller';
import {
  getRangosCuentas,
  postRangoCuenta,
  putRangoCuenta,
  deleteRangoCuenta,
} from './rangos.controller';
import { getEjerciciosDisponibles, getSaldosMes, getSaldosAnio, getAuxiliarCuenta } from './saldos.controller';
import {
  getTiposPoliza,
  postTipoPoliza,
  putTipoPoliza,
  patchTipoPolizaActivo,
  deleteTipoPoliza,
} from './tiposPoliza.controller';
import {
  getPolizas,
  getMovimientosPoliza,
  getPoliza,
  getSiguienteNumero,
  postPoliza,
  putPoliza,
  deletePoliza,
  patchPolizaEstatus,
  postPolizasEstatusLote,
} from './polizas.controller';
import { getBalanzaAnalitica, getEstadoResultados, getBalanceGeneral } from './reportesContables.controller';
import { getValidacionesEContabilidad, getSugerenciasCodigosAgrupadores } from './eContabilidad.controller';
import { getCodigosAgrupadores } from './codigosAgrupadores.controller';
import { getSaldosIniciales, patchSaldosInicialesLote } from './saldosIniciales.controller';

const router = Router();

router.use(requireAuth, requireEmpresaActiva);

router.get('/cuentas/validar-nueva', getValidarNuevaCuenta);
router.get('/cuentas/saldos-mes', getSaldosMes);
router.get('/cuentas/afectables', getCuentasAfectables);
router.get('/cuentas', getCuentas);
router.get('/cuentas/:id', getCuenta);
router.get('/cuentas/:id/saldos-anio', getSaldosAnio);
router.get('/cuentas/:id/auxiliar', getAuxiliarCuenta);
router.post('/cuentas', postCuenta);
router.put('/cuentas/:id', putCuenta);
router.patch('/cuentas/codigos-agrupadores-sat/lote', patchCuentasCodigoAgrupadorSatLote);
router.patch('/cuentas/:id/estado', patchCuentaEstado);
router.patch('/cuentas/:id/codigo-agrupador-sat', patchCuentaCodigoAgrupadorSat);
router.delete('/cuentas/:id', deleteCuenta);

router.get('/configuracion', getConfiguracion);
router.put('/configuracion', putConfiguracion);

router.get('/rangos-cuentas', getRangosCuentas);
router.post('/rangos-cuentas', postRangoCuenta);
router.put('/rangos-cuentas/:id', putRangoCuenta);
router.delete('/rangos-cuentas/:id', deleteRangoCuenta);

router.get('/ejercicios', getEjerciciosDisponibles);

router.get('/tipos-poliza', getTiposPoliza);
router.post('/tipos-poliza', postTipoPoliza);
router.put('/tipos-poliza/:id', putTipoPoliza);
router.patch('/tipos-poliza/:id/activo', patchTipoPolizaActivo);
router.delete('/tipos-poliza/:id', deleteTipoPoliza);

router.get('/polizas/siguiente-numero', getSiguienteNumero);
router.get('/polizas', getPolizas);
router.get('/polizas/:id', getPoliza);
router.get('/polizas/:id/movimientos', getMovimientosPoliza);
router.post('/polizas', postPoliza);
router.post('/polizas/estatus-lote', postPolizasEstatusLote);
router.put('/polizas/:id', putPoliza);
router.patch('/polizas/:id/estatus', patchPolizaEstatus);
router.delete('/polizas/:id', deletePoliza);

router.get('/reportes/balanza-analitica', getBalanzaAnalitica);
router.get('/reportes/estado-resultados', getEstadoResultados);
router.get('/reportes/balance-general', getBalanceGeneral);

router.get('/e-contabilidad/validaciones', getValidacionesEContabilidad);
router.get('/e-contabilidad/sugerencias-codigos-agrupadores', getSugerenciasCodigosAgrupadores);
router.get('/e-contabilidad/codigos-agrupadores', getCodigosAgrupadores);
router.get('/e-contabilidad/saldos-iniciales', getSaldosIniciales);
router.patch('/e-contabilidad/saldos-iniciales', patchSaldosInicialesLote);

export default router;
