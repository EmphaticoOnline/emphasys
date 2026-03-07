import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from "../auth/auth.middleware";
import { getUnidades } from './unidades.controller';

const router = Router();

router.get('/', requireAuth, requireEmpresaActiva, getUnidades);

export default router;
