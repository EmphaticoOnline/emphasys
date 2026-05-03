import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../modules/auth/auth.middleware';
import { actualizarEstatusOportunidad, listarOportunidadesPorConversacion } from './oportunidades.controller';

const router = Router();

router.get('/oportunidades', requireAuth, requireEmpresaActiva, listarOportunidadesPorConversacion);
router.patch('/oportunidades/:id', requireAuth, requireEmpresaActiva, actualizarEstatusOportunidad);

export default router;