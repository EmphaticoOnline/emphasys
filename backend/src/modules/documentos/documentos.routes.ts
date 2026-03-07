import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from "../auth/auth.middleware";
import {
  agregarPartida,
  crearCotizacion,
  listarCotizaciones,
  obtenerCotizacion,
  actualizarCotizacion,
  reemplazarPartidas,
  eliminarCotizacion,
  obtenerCotizacionPDF,
} from './documentos.controller';

const router = Router();

// GET /api/documentos?tipo_documento=Cotizacion
router.get('/', requireAuth, requireEmpresaActiva, listarCotizaciones);

// GET /api/documentos/:id
router.get('/:id', requireAuth, requireEmpresaActiva, obtenerCotizacion);

// GET /api/documentos/:id/pdf
router.get('/:id/pdf', requireAuth, requireEmpresaActiva, obtenerCotizacionPDF);

// POST /api/documentos
router.post('/', requireAuth, requireEmpresaActiva, crearCotizacion);

// PUT /api/documentos/:id
router.put('/:id', requireAuth, requireEmpresaActiva, actualizarCotizacion);

// DELETE /api/documentos/:id
router.delete('/:id', requireAuth, requireEmpresaActiva, eliminarCotizacion);

// POST /api/documentos/:id/partidas
router.post('/:id/partidas', requireAuth, requireEmpresaActiva, agregarPartida);

// PUT /api/documentos/:id/partidas (reemplaza todas)
router.put('/:id/partidas', requireAuth, requireEmpresaActiva, reemplazarPartidas);

export default router;
