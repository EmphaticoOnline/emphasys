import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import {
  listarTransicionesHandler,
  listarReglasHandler,
  crearReglaHandler,
  actualizarReglaHandler,
  desactivarReglaHandler,
  listarBandejaHandler,
  listarMisSolicitudesHandler,
  obtenerSolicitudHandler,
  responderSolicitudHandler,
  cancelarSolicitudHandler,
} from './autorizaciones.controller';

const router = Router();
router.use(requireAuth, requireEmpresaActiva);

// Transiciones disponibles (para selector de configuración)
router.get('/transiciones', listarTransicionesHandler);

// Políticas de autorización (configuración)
router.get('/reglas', listarReglasHandler);
router.post('/reglas', crearReglaHandler);
router.put('/reglas/:id', actualizarReglaHandler);
router.delete('/reglas/:id', desactivarReglaHandler);

// Solicitudes — rutas específicas antes de /:id para evitar conflictos de Express
router.get('/solicitudes/bandeja', listarBandejaHandler);
router.get('/solicitudes/mis-solicitudes', listarMisSolicitudesHandler);
router.get('/solicitudes/:id', obtenerSolicitudHandler);
router.put('/solicitudes/:id/responder', responderSolicitudHandler);
router.put('/solicitudes/:id/cancelar', cancelarSolicitudHandler);

export default router;
