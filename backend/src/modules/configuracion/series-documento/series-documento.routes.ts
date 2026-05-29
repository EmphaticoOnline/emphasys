import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../../auth/auth.middleware';
import {
  actualizarAsignacionSerieDocumentoController,
  actualizarSerieDocumentoActivaController,
  actualizarSerieDocumentoAdminController,
  crearAsignacionSerieDocumentoController,
  crearSerieDocumentoAdminController,
  eliminarAsignacionSerieDocumentoController,
  obtenerAsignacionesSeriesDocumentoController,
  obtenerSeriesDocumentoAdmin,
} from './series-documento.controller';

const router = Router();

router.get('/configuracion/series-documento', requireAuth, requireEmpresaActiva, obtenerSeriesDocumentoAdmin);
router.post('/configuracion/series-documento', requireAuth, requireEmpresaActiva, crearSerieDocumentoAdminController);
router.put('/configuracion/series-documento/:id', requireAuth, requireEmpresaActiva, actualizarSerieDocumentoAdminController);
router.patch('/configuracion/series-documento/:id/activa', requireAuth, requireEmpresaActiva, actualizarSerieDocumentoActivaController);

router.get('/configuracion/series-documento/asignaciones', requireAuth, requireEmpresaActiva, obtenerAsignacionesSeriesDocumentoController);
router.post('/configuracion/series-documento/asignaciones', requireAuth, requireEmpresaActiva, crearAsignacionSerieDocumentoController);
router.put('/configuracion/series-documento/asignaciones/:id', requireAuth, requireEmpresaActiva, actualizarAsignacionSerieDocumentoController);
router.delete('/configuracion/series-documento/asignaciones/:id', requireAuth, requireEmpresaActiva, eliminarAsignacionSerieDocumentoController);

export default router;