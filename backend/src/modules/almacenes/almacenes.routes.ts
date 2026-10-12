import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import { actualizarAlmacen, crearAlmacen, eliminarAlmacen, listarAlmacenes, listarTodosLosAlmacenes } from './almacenes.controller';
import { requireAdministradorInventario } from '../auth/auth.middleware';

const router = Router();

router.get('/', requireAuth, requireEmpresaActiva, listarAlmacenes);
router.get('/admin', requireAuth, requireEmpresaActiva, requireAdministradorInventario, listarTodosLosAlmacenes);
router.post('/', requireAuth, requireEmpresaActiva, requireAdministradorInventario, crearAlmacen);
router.put('/:id', requireAuth, requireEmpresaActiva, requireAdministradorInventario, actualizarAlmacen);
router.delete('/:id', requireAuth, requireEmpresaActiva, requireAdministradorInventario, eliminarAlmacen);

export default router;
