import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import { listarCatalogos, crearCatalogo, actualizarCatalogo, obtenerCatalogoTipo, eliminarCatalogo } from './catalogos.controller';

const router = Router();

router.get('/', requireAuth, requireEmpresaActiva, listarCatalogos);
router.get('/tipos/:id', requireAuth, obtenerCatalogoTipo);
router.post('/', requireAuth, requireEmpresaActiva, crearCatalogo);
router.put('/:id', requireAuth, requireEmpresaActiva, actualizarCatalogo);
router.delete('/:id', requireAuth, requireEmpresaActiva, eliminarCatalogo);

export default router;
