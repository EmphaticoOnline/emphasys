import { Request, Response } from 'express';
import { getProductosRepository, updateProductoRepository, deleteProductoRepository, insertarProductoRepository } from './productos.repository';
// POST /api/productos
export async function crearProducto(req: Request, res: Response) {
  try {
    const producto = await insertarProductoRepository(req.body);
    res.status(201).json(producto);
  } catch (error) {
    // Mostrar el error real en la respuesta para depuración
    res.status(500).json({ error: 'Error al crear producto', detalle: error instanceof Error ? error.message : error });
  }
}

// GET /api/productos
export async function getProductos(req: Request, res: Response) {
  try {
    const productos = await getProductosRepository();
    res.json(productos);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener productos' });
  }
}

// PUT /api/productos/:id
export async function updateProducto(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const producto = await updateProductoRepository(id, req.body);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(producto);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
}

// DELETE /api/productos/:id
export async function deleteProducto(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const producto = await deleteProductoRepository(id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(producto);
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
}
