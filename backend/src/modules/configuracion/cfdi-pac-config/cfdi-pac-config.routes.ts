import { Router } from 'express';
import { requireAuth, requireSuperadmin } from '../../auth/auth.middleware';
import {
  actualizarCfdiPacConfigController,
  crearCfdiPacConfigController,
  listarCfdiPacConfigController,
} from './cfdi-pac-config.controller';

const router = Router();

router.get('/configuracion/cfdi-pac', requireAuth, requireSuperadmin, listarCfdiPacConfigController);
router.post('/configuracion/cfdi-pac', requireAuth, requireSuperadmin, crearCfdiPacConfigController);
router.patch('/configuracion/cfdi-pac/:id', requireAuth, requireSuperadmin, actualizarCfdiPacConfigController);
router.put('/configuracion/cfdi-pac/:id', requireAuth, requireSuperadmin, actualizarCfdiPacConfigController);

export default router;