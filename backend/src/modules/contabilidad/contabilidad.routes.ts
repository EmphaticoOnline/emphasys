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
import { getCatalogoXmlPreview, getCatalogoXmlDescargar } from './catalogoCuentasXml.controller';
import { getBalanzaXmlPreview, getBalanzaXmlDescargar } from './balanzaComprobacionXml.controller';
import { getPolizasSatPreview } from './polizasSat.controller';
import { getPolizasXmlPreview, getPolizasXmlDescargar } from './polizasPeriodoXml.controller';
import { getAuxiliarFoliosPreview, getAuxiliarFoliosDescargar } from './auxiliarFoliosXml.controller';
import { getAuxiliarCuentasPreview, getAuxiliarCuentasDescargar } from './auxiliarCuentasXml.controller';
import { getPaqueteZipPreview, getPaqueteZipDescargar } from './paqueteZip.controller';
import { getBitacoraPaquetes } from './bitacoraPaquetes.controller';
import {
  getConfiguracionesCuentasContables,
  getConfiguracionCuentaContable,
  postConfiguracionCuentaContable,
  putConfiguracionCuentaContable,
  deleteConfiguracionCuentaContable,
  getValoresProducto,
} from './configuracionCuentasContables.controller';
import {
  getContabilizacionesDocumento,
  getEstadoContableDocumento,
  getEditableDocumento,
  getContabilizacionesOperacionDinero,
  getEstadoContableOperacionDinero,
  getEditableOperacionDinero,
  getContabilizacionesMovimientoInventario,
  getEstadoContableMovimientoInventario,
  getEditableMovimientoInventario,
  getContabilizacionesPoliza,
  getContabilizacion,
  postContabilizacion,
  postReversaContabilizacion,
} from './contabilizaciones.controller';
import {
  postPreviewFacturaVenta,
  postContabilizarFacturaVenta,
  postContabilizarFacturasVentaLote,
  postEstadoContableFacturasVentaLote,
  postReversaCancelacionFacturaVenta,
} from './facturaVentaContabilizacion.controller';

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
router.get('/e-contabilidad/catalogo-xml/preview', getCatalogoXmlPreview);
router.get('/e-contabilidad/catalogo-xml/descargar', getCatalogoXmlDescargar);
router.get('/e-contabilidad/balanza-xml/preview', getBalanzaXmlPreview);
router.get('/e-contabilidad/balanza-xml/descargar', getBalanzaXmlDescargar);
router.get('/e-contabilidad/polizas-sat/preview', getPolizasSatPreview);
router.get('/e-contabilidad/polizas-xml/preview', getPolizasXmlPreview);
router.get('/e-contabilidad/polizas-xml/descargar', getPolizasXmlDescargar);
router.get('/e-contabilidad/auxiliares-sat/folios/preview', getAuxiliarFoliosPreview);
router.get('/e-contabilidad/auxiliares-sat/folios/descargar', getAuxiliarFoliosDescargar);
router.get('/e-contabilidad/auxiliares-sat/cuentas/preview', getAuxiliarCuentasPreview);
router.get('/e-contabilidad/auxiliares-sat/cuentas/descargar', getAuxiliarCuentasDescargar);
router.get('/e-contabilidad/paquete-zip/preview', getPaqueteZipPreview);
router.get('/e-contabilidad/paquete-zip/descargar', getPaqueteZipDescargar);
router.get('/e-contabilidad/bitacora', getBitacoraPaquetes);

router.get('/configuracion-cuentas-contables/valores-producto', getValoresProducto);
router.get('/configuracion-cuentas-contables', getConfiguracionesCuentasContables);
router.get('/configuracion-cuentas-contables/:id', getConfiguracionCuentaContable);
router.post('/configuracion-cuentas-contables', postConfiguracionCuentaContable);
router.put('/configuracion-cuentas-contables/:id', putConfiguracionCuentaContable);
router.delete('/configuracion-cuentas-contables/:id', deleteConfiguracionCuentaContable);

router.get('/contabilizaciones/documento/:documentoId', getContabilizacionesDocumento);
router.get('/contabilizaciones/documento/:documentoId/estado', getEstadoContableDocumento);
router.get('/contabilizaciones/documento/:documentoId/editable', getEditableDocumento);
router.get('/contabilizaciones/operacion-dinero/:operacionDineroId', getContabilizacionesOperacionDinero);
router.get('/contabilizaciones/operacion-dinero/:operacionDineroId/estado', getEstadoContableOperacionDinero);
router.get('/contabilizaciones/operacion-dinero/:operacionDineroId/editable', getEditableOperacionDinero);
router.get('/contabilizaciones/movimiento-inventario/:movimientoInventarioId', getContabilizacionesMovimientoInventario);
router.get('/contabilizaciones/movimiento-inventario/:movimientoInventarioId/estado', getEstadoContableMovimientoInventario);
router.get('/contabilizaciones/movimiento-inventario/:movimientoInventarioId/editable', getEditableMovimientoInventario);
router.get('/contabilizaciones/poliza/:polizaId', getContabilizacionesPoliza);
router.get('/contabilizaciones/:id', getContabilizacion);
router.post('/contabilizaciones', postContabilizacion);
router.post('/contabilizaciones/:id/reversa', postReversaContabilizacion);

router.post('/ventas/facturas/estado-contable-lote', postEstadoContableFacturasVentaLote);
router.post('/ventas/facturas/:documentoId/preview', postPreviewFacturaVenta);
router.post('/ventas/facturas/:documentoId/contabilizar', postContabilizarFacturaVenta);
router.post('/ventas/facturas/lote', postContabilizarFacturasVentaLote);
router.post('/ventas/facturas/:documentoId/reversa-cancelacion', postReversaCancelacionFacturaVenta);

export default router;
