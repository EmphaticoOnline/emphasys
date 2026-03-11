import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware';
import { obtenerEntidadesTipos } from './entidades-tipos.controller';

const router = Router();

router.get('/', requireAuth, obtenerEntidadesTipos);

export default router;
