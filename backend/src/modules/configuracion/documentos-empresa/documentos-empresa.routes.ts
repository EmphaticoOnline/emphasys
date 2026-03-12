import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../../auth/auth.middleware';
import {
  actualizarDocumentoEmpresa,
  actualizarTransicionDocumento,
  listarDocumentosEmpresa,
  obtenerFlujoDocumentos,
} from './documentos-empresa.controller';

const router = Router();

router.get('/configuracion/documentos-empresa', requireAuth, requireEmpresaActiva, listarDocumentosEmpresa);
router.put('/configuracion/documentos-empresa/:tipoDocumentoId', requireAuth, requireEmpresaActiva, actualizarDocumentoEmpresa);

router.get('/configuracion/documentos-flujo', requireAuth, requireEmpresaActiva, obtenerFlujoDocumentos);
router.put('/configuracion/documentos-flujo', requireAuth, requireEmpresaActiva, actualizarTransicionDocumento);

export default router;