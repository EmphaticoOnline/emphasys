import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import { actualizarRolHandler, crearRolHandler, eliminarRolHandler, getRoles } from './roles.controller';

const router = Router();

router.get('/empresas/:empresaId/roles', requireAuth, requireEmpresaActiva, getRoles);
router.post('/roles', requireAuth, requireEmpresaActiva, crearRolHandler);
router.put('/roles/:id', requireAuth, requireEmpresaActiva, actualizarRolHandler);
router.delete('/roles/:id', requireAuth, requireEmpresaActiva, eliminarRolHandler);

export default router;
