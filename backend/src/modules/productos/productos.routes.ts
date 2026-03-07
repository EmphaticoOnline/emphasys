import { Router } from 'express';
import { requireAuth, requireEmpresaActiva } from "../auth/auth.middleware";
import { getProductos, updateProducto, deleteProducto, crearProducto, getProducto, listarCatalogosConfigurablesDeProducto, guardarCatalogosConfigurablesProducto } from './productos.controller';

const router = Router();

// GET /api/productos
router.get('/', requireAuth, requireEmpresaActiva, getProductos);

router.get('/catalogos-configurables', requireAuth, requireEmpresaActiva, listarCatalogosConfigurablesDeProducto);

// GET /api/productos/:id
router.get('/:id/catalogos-configurables', requireAuth, requireEmpresaActiva, listarCatalogosConfigurablesDeProducto);
router.get('/:id', requireAuth, requireEmpresaActiva, getProducto);


// POST /api/productos
router.post('/', requireAuth, requireEmpresaActiva, crearProducto);

// PUT /api/productos/:id
router.put('/:id/catalogos-configurables', requireAuth, requireEmpresaActiva, guardarCatalogosConfigurablesProducto);
router.put('/:id', requireAuth, requireEmpresaActiva, updateProducto);

// DELETE /api/productos/:id
router.delete('/:id', requireAuth, requireEmpresaActiva, deleteProducto);

export default router;
