import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import {
  getEstadoCuentaProveedor,
  getEstadoCuentaCliente,
  getComprasPorProveedor,
} from './reportes.controller';

const router = Router();

router.use(requireAuth, requireEmpresaActiva);

router.get('/compras/estado-cuenta-proveedor', getEstadoCuentaProveedor);
router.get('/compras/compras-por-proveedor',   getComprasPorProveedor);
router.get('/ventas/estado-cuenta-cliente',    getEstadoCuentaCliente);

export default router;
