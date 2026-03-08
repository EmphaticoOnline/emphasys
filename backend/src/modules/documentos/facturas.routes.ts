import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import {
  listarFacturas,
  obtenerFactura,
  crearFactura,
  actualizarFactura,
  eliminarFactura,
  agregarPartida,
  reemplazarPartidas,
  obtenerFacturaPDF,
  obtenerFacturaXML,
  timbrarFacturaCfdi,
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

// POST /api/facturas
router.post('/', requireAuth, requireEmpresaActiva, crearFactura);

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

export default router;
