import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../modules/auth/auth.middleware';
import { listarOportunidadesPorConversacion } from './oportunidades.controller';

const router = Router();

router.get('/oportunidades', requireAuth, requireEmpresaActiva, listarOportunidadesPorConversacion);

export default router;