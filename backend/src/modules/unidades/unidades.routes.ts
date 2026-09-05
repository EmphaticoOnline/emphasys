import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from "../auth/auth.middleware";
import { actualizarUnidad, crearUnidad, eliminarUnidad, getUnidades } from './unidades.controller';

const router = Router();

router.get('/', requireAuth, requireEmpresaActiva, getUnidades);
router.post('/', requireAuth, requireEmpresaActiva, crearUnidad);
router.put('/:id', requireAuth, requireEmpresaActiva, actualizarUnidad);
router.delete('/:id', requireAuth, requireEmpresaActiva, eliminarUnidad);

export default router;
