import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import { listarAlmacenes } from './almacenes.controller';

const router = Router();

router.get('/', requireAuth, requireEmpresaActiva, listarAlmacenes);

export default router;
