import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import { getGridPreference, putGridPreference } from './grid-preferences.controller';

const router = Router();

router.get('/:pantalla', requireAuth, requireEmpresaActiva, getGridPreference);
router.put('/:pantalla', requireAuth, requireEmpresaActiva, putGridPreference);

export default router;
