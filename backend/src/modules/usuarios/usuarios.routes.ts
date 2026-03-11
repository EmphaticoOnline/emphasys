import { Router } from 'express';
import {
  deleteUsuario,
  getUsuario,
  getUsuarios,
  postUsuario,
  postUsuarioEmpresas,
  postUsuarioRoles,
  putUsuario,
  getUsuarioEmpresas,
} from './usuarios.controller';

const router = Router();

router.get('/', getUsuarios);
router.get('/:id', getUsuario);
router.get('/:id/empresas', getUsuarioEmpresas);
router.post('/', postUsuario);
router.put('/:id', putUsuario);
router.delete('/:id', deleteUsuario);
router.post('/:id/empresas', postUsuarioEmpresas);
router.post('/:id/roles', postUsuarioRoles);

export default router;
