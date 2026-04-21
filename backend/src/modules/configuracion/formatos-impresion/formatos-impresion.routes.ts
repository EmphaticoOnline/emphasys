import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../../auth/auth.middleware';
import { guardarLayoutConfiguracion, obtenerLayoutConfiguracion } from './formatos-impresion.controller';

const router = Router();

router.get('/configuracion/layout', requireAuth, requireEmpresaActiva, obtenerLayoutConfiguracion);
router.post('/configuracion/layout', requireAuth, requireEmpresaActiva, guardarLayoutConfiguracion);

export default router;
