import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import {
  actualizarImpuestoDefault,
  crearImpuestoDefault,
  eliminarImpuestoDefault,
  getImpuestosCatalogo,
  getImpuestosDefaultEmpresa,
} from './impuestos.controller';

const router = Router();

router.get('/impuestos', requireAuth, requireEmpresaActiva, getImpuestosCatalogo);

router.get('/empresas/impuestos-default', requireAuth, requireEmpresaActiva, getImpuestosDefaultEmpresa);
router.post('/empresas/impuestos-default', requireAuth, requireEmpresaActiva, crearImpuestoDefault);
router.put('/empresas/impuestos-default/:id', requireAuth, requireEmpresaActiva, actualizarImpuestoDefault);
router.delete('/empresas/impuestos-default/:id', requireAuth, requireEmpresaActiva, eliminarImpuestoDefault);

export default router;
