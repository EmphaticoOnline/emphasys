import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../modules/auth/auth.middleware';
import { actualizarActividad, actualizarEstatusActividad, crearActividad, listarActividadesUsuario, listarRecordatoriosActividades, marcarRecordatorioActividadDisparado, obtenerActividadPorId } from './actividades.controller';
import { actualizarEstatusOportunidad, eliminarOportunidad, listarOportunidadesPorConversacion, obtenerOportunidadPorId } from './oportunidades.controller';

const router = Router();

router.get('/actividades', requireAuth, requireEmpresaActiva, listarActividadesUsuario);
router.get('/actividades/recordatorios', requireAuth, requireEmpresaActiva, listarRecordatoriosActividades);
router.get('/actividades/:id', requireAuth, requireEmpresaActiva, obtenerActividadPorId);
router.post('/actividades', requireAuth, requireEmpresaActiva, crearActividad);
router.put('/actividades/:id', requireAuth, requireEmpresaActiva, actualizarActividad);
router.patch('/actividades/:id', requireAuth, requireEmpresaActiva, actualizarEstatusActividad);
router.patch('/actividades/:id/recordatorio-disparado', requireAuth, requireEmpresaActiva, marcarRecordatorioActividadDisparado);
router.get('/oportunidades', requireAuth, requireEmpresaActiva, listarOportunidadesPorConversacion);
router.get('/oportunidades/:id', requireAuth, requireEmpresaActiva, obtenerOportunidadPorId);
router.patch('/oportunidades/:id', requireAuth, requireEmpresaActiva, actualizarEstatusOportunidad);
router.delete('/oportunidades/:id', requireAuth, requireEmpresaActiva, eliminarOportunidad);

export default router;