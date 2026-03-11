import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import { guardarCamposDocumento, obtenerCamposDocumento } from './documentos-campos.controller';

const router = Router();

router.post('/', requireAuth, requireEmpresaActiva, guardarCamposDocumento);
router.get('/:documentoId', requireAuth, requireEmpresaActiva, obtenerCamposDocumento);
router.get('/:documentoId', requireAuth, requireEmpresaActiva, obtenerCamposDocumento);

export default router;
