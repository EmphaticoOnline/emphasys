import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import { listarCamposConfiguracion, crearCampo, actualizarCampo, eliminarCampo } from './campos-configuracion.controller';

const router = Router();

router.get('/', requireAuth, requireEmpresaActiva, listarCamposConfiguracion);
router.post('/', requireAuth, requireEmpresaActiva, crearCampo);
router.put('/:id', requireAuth, requireEmpresaActiva, actualizarCampo);
router.delete('/:id', requireAuth, requireEmpresaActiva, eliminarCampo);

export default router;
