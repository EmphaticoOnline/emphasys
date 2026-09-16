import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import { requireAdminConfiguracion } from '../configuracion/horarios-laborales/horarios-laborales.controller';
import { getBloques, getMetricas } from './metricas.controller';
const router = Router();
router.use(requireAuth, requireEmpresaActiva, requireAdminConfiguracion);
router.get('/metricas', getMetricas);
router.get('/bloques', getBloques);
export default router;
