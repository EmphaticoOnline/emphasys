import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import {
  deleteUsuario,
  getUsuario,
  getUsuarios,
  getUsuariosHabilitados,
  postUsuario,
  postUsuarioEmpresas,
  postUsuarioRoles,
  putUsuario,
  getUsuarioEmpresas,
} from './usuarios.controller';

const router = Router();

router.get('/', getUsuarios);
router.get('/habilitados', requireAuth, requireEmpresaActiva, getUsuariosHabilitados);
router.get('/:id', getUsuario);
router.get('/:id/empresas', getUsuarioEmpresas);
router.post('/', postUsuario);
router.put('/:id', putUsuario);
router.delete('/:id', deleteUsuario);
router.post('/:id/empresas', postUsuarioEmpresas);
router.post('/:id/roles', postUsuarioRoles);

export default router;
