import { Router } from 'express';
import { getProductos, updateProducto, deleteProducto, crearProducto } from './productos.controller';

const router = Router();

// GET /api/productos

// GET /api/productos
router.get('/', getProductos);


// POST /api/productos
router.post('/', crearProducto);

// PUT /api/productos/:id
router.put('/:id', updateProducto);

// DELETE /api/productos/:id
router.delete('/:id', deleteProducto);

export default router;
