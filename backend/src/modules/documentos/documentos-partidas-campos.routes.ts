import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import { guardarCamposPartida, obtenerCamposPartida } from './documentos-campos.controller';

const router = Router();

router.post('/', requireAuth, requireEmpresaActiva, guardarCamposPartida);
router.get('/:partidaId', requireAuth, requireEmpresaActiva, obtenerCamposPartida);
router.get('/:partidaId/campos', requireAuth, requireEmpresaActiva, obtenerCamposPartida);

export default router;
