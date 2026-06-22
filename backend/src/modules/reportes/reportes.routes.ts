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
} from './reportes.controller';

const router = Router();

router.use(requireAuth, requireEmpresaActiva);

router.get('/compras/estado-cuenta-proveedor',   getEstadoCuentaProveedor);
router.get('/compras/compras-por-proveedor',     getComprasPorProveedor);
router.get('/compras/compras-por-producto',      getComprasPorProducto);
router.get('/compras/oc-pendientes-recibir',     getOCPendientesRecibir);
router.get('/ventas/ventas-por-cliente',         getVentasPorCliente);
router.get('/ventas/ventas-por-producto',        getVentasPorProducto);
router.get('/ventas/estado-cuenta-cliente',      getEstadoCuentaCliente);

export default router;
