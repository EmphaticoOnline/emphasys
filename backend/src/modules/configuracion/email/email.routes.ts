import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../../auth/auth.middleware';
import {
  guardarConfiguracionEmailController,
  guardarConfiguracionEmailUsuarioController,
  obtenerConfiguracionEmail,
  obtenerConfiguracionEmailUsuario,
  probarConfiguracionEmailController,
} from './email.controller';

const router = Router();

router.get('/configuracion/email', requireAuth, requireEmpresaActiva, obtenerConfiguracionEmail);
router.post('/configuracion/email', requireAuth, requireEmpresaActiva, guardarConfiguracionEmailController);
router.get('/configuracion/email/usuario', requireAuth, requireEmpresaActiva, obtenerConfiguracionEmailUsuario);
router.post('/configuracion/email/usuario', requireAuth, requireEmpresaActiva, guardarConfiguracionEmailUsuarioController);
router.post('/configuracion/email/test', requireAuth, requireEmpresaActiva, probarConfiguracionEmailController);

export default router;