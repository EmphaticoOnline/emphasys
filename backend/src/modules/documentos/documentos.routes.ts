import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from "../auth/auth.middleware";
import {
  agregarPartida,
  crearCotizacion,
  timbrarDocumentoCfdi,
  timbrarComplementoPagoHandler,
  enviarCotizacionPorCorreo,
  enviarWhatsappCotizacion,
  listarCotizaciones,
  obtenerCotizacion,
  validarEliminacionCotizacion,
  actualizarCotizacion,
  duplicarCotizacion,
  duplicarDocumentosMasivo,
  reemplazarPartidas,
  eliminarCotizacion,
  cancelarDocumento,
  obtenerCotizacionPDF,
  calcularImpuestosPreviewHandler,
  exportarDocumentos,
  obtenerRecepcionResumenHandler,
} from './documentos.controller';
import { obtenerCamposDocumento } from './documentos-campos.controller';
import { obtenerDetalleDocumentoHandler } from './documentos-detalle.controller';

const router = Router();

// GET /api/documentos?tipo_documento=Cotizacion
router.get('/', requireAuth, requireEmpresaActiva, listarCotizaciones);

// GET /api/documentos/:id
router.get('/:id', requireAuth, requireEmpresaActiva, obtenerCotizacion);

// GET /api/documentos/:id/detalle (drawer de consulta: partidas, pagos, NC, relacionados, inventario)
router.get('/:id/detalle', requireAuth, requireEmpresaActiva, obtenerDetalleDocumentoHandler);

// GET /api/documentos/:id/recepcion-resumen
router.get('/:id/recepcion-resumen', requireAuth, requireEmpresaActiva, obtenerRecepcionResumenHandler);

// GET /api/documentos/:id/validar-eliminacion
router.get('/:id/validar-eliminacion', requireAuth, requireEmpresaActiva, validarEliminacionCotizacion);

// GET /api/documentos/:id/campos (valores dinámicos)
router.get('/:id/campos', requireAuth, requireEmpresaActiva, obtenerCamposDocumento);

// GET /api/documentos/:id/pdf
router.get('/:id/pdf', requireAuth, requireEmpresaActiva, obtenerCotizacionPDF);

// POST /api/documentos/:id/enviar-email
router.post('/:id/enviar-email', requireAuth, requireEmpresaActiva, enviarCotizacionPorCorreo);

// POST /api/documentos/:id/enviar-whatsapp-cotizacion
router.post('/:id/enviar-whatsapp-cotizacion', requireAuth, requireEmpresaActiva, enviarWhatsappCotizacion);

// POST /api/documentos
router.post('/exportar', requireAuth, requireEmpresaActiva, exportarDocumentos);
router.post('/', requireAuth, requireEmpresaActiva, crearCotizacion);

// POST /api/documentos/duplicar-masivo
router.post('/duplicar-masivo', requireAuth, requireEmpresaActiva, duplicarDocumentosMasivo);

// PUT /api/documentos/:id
router.put('/:id', requireAuth, requireEmpresaActiva, actualizarCotizacion);

// POST /api/documentos/:id/duplicar
router.post('/:id/duplicar', requireAuth, requireEmpresaActiva, duplicarCotizacion);

// DELETE /api/documentos/:id
router.delete('/:id', requireAuth, requireEmpresaActiva, eliminarCotizacion);

// POST /api/documentos/:id/partidas
router.post('/:id/partidas', requireAuth, requireEmpresaActiva, agregarPartida);

// PUT /api/documentos/:id/partidas (reemplaza todas)
router.put('/:id/partidas', requireAuth, requireEmpresaActiva, reemplazarPartidas);

// POST /api/documentos/:id/timbrar-cfdi
router.post('/:id/timbrar-cfdi', requireAuth, requireEmpresaActiva, timbrarDocumentoCfdi);

// POST /api/documentos/:id/timbrar-complemento-pago
router.post('/:id/timbrar-complemento-pago', requireAuth, requireEmpresaActiva, timbrarComplementoPagoHandler);

// POST /api/documentos/:id/cancelar
router.post('/:id/cancelar', requireAuth, requireEmpresaActiva, cancelarDocumento);

// POST /api/documentos/calcular-impuestos (preview sin persistir)
router.post('/calcular-impuestos', requireAuth, requireEmpresaActiva, calcularImpuestosPreviewHandler);

export default router;
