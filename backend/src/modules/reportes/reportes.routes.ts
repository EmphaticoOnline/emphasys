import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import {
  getEstadoCuentaProveedor,
  getEstadoCuentaCliente,
  getComprasPorProveedor,
  getVentasPorCliente,
  getComprasPorProducto,
  getVentasPorProducto,
  getOCPendientesRecibir,
  getVencimientosProveedores,
  getHistorialPreciosCompra,
  getHistorialPreciosVenta,
  getComprasPorPeriodo,
  getVentasPorPeriodo,
  getPedidosPendientesFacturar,
  getRemisionesPendientesFacturar,
  getVencimientosClientes,
  getPagosClientes,
  getPagosProveedores,
  getPosicionTesoreria,
  getCarteraVencida,
  getMovimientosNoConciliados,
  getExistenciasPorAlmacen,
  getKardexProducto,
  getMovimientosInventarioPeriodo,
  getProductosBajoMinimo,
  getInventarioValorizado,
} from './reportes.controller';

const router = Router();

router.use(requireAuth, requireEmpresaActiva);

router.get('/compras/estado-cuenta-proveedor',         getEstadoCuentaProveedor);
router.get('/compras/compras-por-proveedor',           getComprasPorProveedor);
router.get('/compras/compras-por-producto',            getComprasPorProducto);
router.get('/compras/oc-pendientes-recibir',           getOCPendientesRecibir);
router.get('/ventas/ventas-por-cliente',               getVentasPorCliente);
router.get('/ventas/ventas-por-producto',              getVentasPorProducto);
router.get('/ventas/estado-cuenta-cliente',            getEstadoCuentaCliente);
router.get('/compras/historial-precios',                getHistorialPreciosCompra);
router.get('/compras/compras-por-periodo',             getComprasPorPeriodo);
router.get('/ventas/historial-precios',                getHistorialPreciosVenta);
router.get('/ventas/ventas-por-periodo',               getVentasPorPeriodo);
router.get('/ventas/pedidos-pendientes-facturar',      getPedidosPendientesFacturar);
router.get('/ventas/remisiones-pendientes-facturar',   getRemisionesPendientesFacturar);
router.get('/finanzas/vencimientos-proveedores',       getVencimientosProveedores);
router.get('/finanzas/vencimientos-clientes',          getVencimientosClientes);
router.get('/finanzas/pagos-clientes',                 getPagosClientes);
router.get('/finanzas/pagos-proveedores',              getPagosProveedores);
router.get('/finanzas/posicion-tesoreria',             getPosicionTesoreria);
router.get('/finanzas/cartera-vencida',                getCarteraVencida);
router.get('/finanzas/movimientos-no-conciliados',     getMovimientosNoConciliados);

router.get('/inventario/existencias-por-almacen',      getExistenciasPorAlmacen);
router.get('/inventario/kardex',                       getKardexProducto);
router.get('/inventario/movimientos-por-periodo',      getMovimientosInventarioPeriodo);
router.get('/inventario/productos-bajo-minimo',        getProductosBajoMinimo);
router.get('/inventario/inventario-valorizado',        getInventarioValorizado);

export default router;
