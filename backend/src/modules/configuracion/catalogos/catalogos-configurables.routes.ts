import { Router } from 'express';
import { requireAuth } from '../../auth/auth.middleware';
import { listarCatalogosConfigurables } from './catalogos-configurables.controller';

const router = Router();

// GET /api/configuracion/catalogos
router.get('/', requireAuth, listarCatalogosConfigurables);

export default router;
