import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import {
  deletePrecioLista,
  getPrecioListaById,
  getPreciosListas,
  postPrecioLista,
  putPrecioLista,
} from './precios-listas.controller';

const router = Router();

router.use(requireAuth, requireEmpresaActiva);

router.get('/', getPreciosListas);
router.get('/:id', getPrecioListaById);
router.post('/', postPrecioLista);
router.put('/:id', putPrecioLista);
router.delete('/:id', deletePrecioLista);

export default router;