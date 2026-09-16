import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import { getBloques, getMetricas } from './metricas.controller';
import { obtenerRolesDeUsuarioEnEmpresa } from '../auth/auth.service';
import type { NextFunction, Request, Response } from 'express';
async function requireAdministradorEvaluacion(req: Request, res: Response, next: NextFunction) {
  if (!req.auth || !req.context?.empresaId) return res.status(401).json({ message: 'No autenticado' });
  try {
    const roles = await obtenerRolesDeUsuarioEnEmpresa(req.auth.userId, req.context.empresaId);
    if (!roles.some((rol) => ['administrador', 'admin'].includes(String(rol.nombre ?? '').trim().toLowerCase()))) return res.status(403).json({ message: 'Sólo usuarios con rol Administrador pueden consultar estas métricas' });
    return next();
  } catch (error) {
    console.error('Error validando rol de evaluación de vendedores:', error);
    return res.status(500).json({ message: 'No se pudieron validar los permisos' });
  }
}
const router = Router();
router.use(requireAuth, requireEmpresaActiva, requireAdministradorEvaluacion);
router.get('/metricas', getMetricas);
router.get('/bloques', getBloques);
export default router;
