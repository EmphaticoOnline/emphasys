import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import {
  listarFacturas,
  obtenerFactura,
  crearFactura,
  actualizarFactura,
  eliminarFactura,
  duplicarDocumentosMasivo,
  agregarPartida,
  reemplazarPartidas,
  obtenerFacturaPDF,
  obtenerFacturaXML,
  obtenerFacturaPublicLinks,
  timbrarFacturaCfdi,
  enviarFacturaPorCorreo,
  enviarFacturaPorWhatsappCfdi,
} from './documentos.controller';

const router = Router();

// GET /api/facturas
router.get('/', requireAuth, requireEmpresaActiva, listarFacturas);

// GET /api/facturas/:id
router.get('/:id', requireAuth, requireEmpresaActiva, obtenerFactura);

// GET /api/facturas/:id/pdf
router.get('/:id/pdf', requireAuth, requireEmpresaActiva, obtenerFacturaPDF);

// GET /api/facturas/:id/xml
router.get('/:id/xml', requireAuth, requireEmpresaActiva, obtenerFacturaXML);

// POST /api/facturas/:id/public-links
router.post('/:id/public-links', requireAuth, requireEmpresaActiva, obtenerFacturaPublicLinks);

// POST /api/facturas/:id/enviar-whatsapp-cfdi
router.post('/:id/enviar-whatsapp-cfdi', requireAuth, requireEmpresaActiva, enviarFacturaPorWhatsappCfdi);

// POST /api/facturas
router.post('/', requireAuth, requireEmpresaActiva, crearFactura);

// POST /api/facturas/duplicar-masivo
router.post('/duplicar-masivo', requireAuth, requireEmpresaActiva, duplicarDocumentosMasivo);

// PUT /api/facturas/:id
router.put('/:id', requireAuth, requireEmpresaActiva, actualizarFactura);

// DELETE /api/facturas/:id
router.delete('/:id', requireAuth, requireEmpresaActiva, eliminarFactura);

// POST /api/facturas/:id/partidas
router.post('/:id/partidas', requireAuth, requireEmpresaActiva, agregarPartida);

// PUT /api/facturas/:id/partidas (reemplaza todas)
router.put('/:id/partidas', requireAuth, requireEmpresaActiva, reemplazarPartidas);

// POST /api/facturas/:id/timbrar
router.post('/:id/timbrar', requireAuth, requireEmpresaActiva, timbrarFacturaCfdi);

// POST /api/facturas/:id/enviar
router.post('/:id/enviar', requireAuth, requireEmpresaActiva, enviarFacturaPorCorreo);

export default router;
