import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import { getConceptos, postConcepto, putConcepto, deleteConcepto } from './conceptos.controller';

const router = Router();

router.use(requireAuth, requireEmpresaActiva);

router.get('/', getConceptos);
router.post('/', postConcepto);
router.put('/:id', putConcepto);
router.delete('/:id', deleteConcepto);

export default router;
