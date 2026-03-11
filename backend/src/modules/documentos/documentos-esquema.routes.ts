import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import { obtenerEsquemaCamposDocumento } from './documentos-esquema.controller';

const router = Router();

router.get('/esquema-campos', requireAuth, requireEmpresaActiva, obtenerEsquemaCamposDocumento);

export default router;
