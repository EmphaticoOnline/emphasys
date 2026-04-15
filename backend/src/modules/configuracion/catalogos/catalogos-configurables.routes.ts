import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../../auth/auth.middleware';
import { listarCatalogosConfigurables } from './catalogos-configurables.controller';

const router = Router();

// GET /api/configuracion/catalogos
router.get('/', requireAuth, requireEmpresaActiva, listarCatalogosConfigurables);

export default router;
