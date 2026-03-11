import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import {
	listarCatalogos,
	crearCatalogo,
	actualizarCatalogo,
	obtenerCatalogoTipo,
	eliminarCatalogo,
	listarCatalogosPorTipoFlexible,
	obtenerCatalogosTipos,
} from './catalogos.controller';
import { getRegimenesFiscalesCatalogo } from './sat/sat.controller';

const router = Router();

router.get('/', requireAuth, requireEmpresaActiva, listarCatalogos);
router.get('/tipos', requireAuth, requireEmpresaActiva, obtenerCatalogosTipos);
router.get('/tipos/:id', requireAuth, obtenerCatalogoTipo);
// Catálogo SAT: régimen fiscal plano (id, descripcion)
router.get('/regimenes-fiscales', requireAuth, requireEmpresaActiva, getRegimenesFiscalesCatalogo);
router.get('/:tipo', requireAuth, requireEmpresaActiva, listarCatalogosPorTipoFlexible);
router.post('/', requireAuth, requireEmpresaActiva, crearCatalogo);
router.put('/:id', requireAuth, requireEmpresaActiva, actualizarCatalogo);
router.delete('/:id', requireAuth, requireEmpresaActiva, eliminarCatalogo);

export default router;
