import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import { deleteDomicilioEmpresa, getDomiciliosEmpresa, patchActivoDomicilioEmpresa, postDomicilioEmpresa, putDomicilioEmpresa } from './empresa-domicilios.controller';

const router = Router();
router.use(requireAuth, requireEmpresaActiva);
router.get('/', getDomiciliosEmpresa);
router.post('/', postDomicilioEmpresa);
router.put('/:domicilioId', putDomicilioEmpresa);
router.patch('/:domicilioId/activo', patchActivoDomicilioEmpresa);
router.delete('/:domicilioId', deleteDomicilioEmpresa);
export default router;
