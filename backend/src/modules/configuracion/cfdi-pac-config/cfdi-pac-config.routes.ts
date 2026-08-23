import { Router } from 'express';
import { requireAuth, requireEmpresaActiva, requireSuperadmin } from '../../auth/auth.middleware';
import {
  actualizarCfdiPacConfigController,
  crearCfdiPacConfigController,
  listarCfdiPacConfigController,
  obtenerAsignacionCfdiPacEmpresaController,
  guardarAsignacionCfdiPacEmpresaController,
} from './cfdi-pac-config.controller';

const router = Router();

router.get('/configuracion/cfdi-pac', requireAuth, requireSuperadmin, listarCfdiPacConfigController);
router.get('/configuracion/cfdi-pac/asignacion', requireAuth, requireSuperadmin, requireEmpresaActiva, obtenerAsignacionCfdiPacEmpresaController);
router.put('/configuracion/cfdi-pac/asignacion', requireAuth, requireSuperadmin, requireEmpresaActiva, guardarAsignacionCfdiPacEmpresaController);
router.post('/configuracion/cfdi-pac', requireAuth, requireSuperadmin, crearCfdiPacConfigController);
router.patch('/configuracion/cfdi-pac/:id', requireAuth, requireSuperadmin, actualizarCfdiPacConfigController);
router.put('/configuracion/cfdi-pac/:id', requireAuth, requireSuperadmin, actualizarCfdiPacConfigController);

export default router;
