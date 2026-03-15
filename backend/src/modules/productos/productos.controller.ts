import { Request, Response } from 'express';
import {
  getProductosRepository,
  updateProductoRepository,
  deleteProductoRepository,
  insertarProductoRepository,
  getProductoByIdRepository,
  obtenerCatalogosConfigurablesDeProducto,
  guardarCatalogosConfigurablesDeProducto,
} from './productos.repository';
// POST /api/productos
export async function crearProducto(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    if (!empresaId) {
      return res.status(400).json({ message: "empresaId no disponible en contexto" });
    }

    const producto = await insertarProductoRepository(req.body, Number(empresaId));
    res.status(201).json(producto);
  } catch (error) {
    // Mostrar el error real en la respuesta para depuración
    res.status(500).json({ error: 'Error al crear producto', detalle: error instanceof Error ? error.message : error });
  }
}

// GET /api/productos
export async function getProductos(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    if (!empresaId) {
      return res.status(400).json({ message: "empresaId no disponible en contexto" });
    }

    const productos = await getProductosRepository(Number(empresaId));
    console.log('[BACK IVA DEBUG] getProductos response sample', productos.slice(0, 3).map((p) => ({ id: p?.id, iva_porcentaje: p?.iva_porcentaje })));
    res.json(productos);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener productos' });
  }
}

// GET /api/productos/:id
export async function getProducto(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    if (!empresaId) {
      return res.status(400).json({ message: "empresaId no disponible en contexto" });
    }

    const producto = await getProductoByIdRepository(id, Number(empresaId));
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(producto);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener producto' });
  }
}

// PUT /api/productos/:id
export async function updateProducto(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    if (!empresaId) {
      return res.status(400).json({ message: "empresaId no disponible en contexto" });
    }

    const producto = await updateProductoRepository(id, req.body, Number(empresaId));
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
    const empresaId = req.context?.empresaId;
    if (!empresaId) {
      return res.status(400).json({ message: "empresaId no disponible en contexto" });
    }

    const producto = await deleteProductoRepository(id, Number(empresaId));
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(producto);
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
}

export async function listarCatalogosConfigurablesDeProducto(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    const productoIdRaw = req.query.productoId;

    if (empresaId === undefined || empresaId === null || Number.isNaN(Number(empresaId))) {
      return res.status(400).json({ message: 'empresaId es obligatorio' });
    }

    const productoId = productoIdRaw !== undefined ? Number(productoIdRaw) : undefined;

    if (productoIdRaw !== undefined && !Number.isFinite(productoId)) {
      return res.status(400).json({ message: 'productoId debe ser numérico' });
    }

    const payload = await obtenerCatalogosConfigurablesDeProducto(Number(empresaId), productoId);
    res.json(payload);
  } catch (error) {
    console.error('Error al obtener catálogos configurables de producto:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

export async function guardarCatalogosConfigurablesProducto(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    const productoId = Number(req.params.id);
    const catalogoIdsRaw = req.body?.catalogoIds;

    if (empresaId === undefined || empresaId === null || Number.isNaN(Number(empresaId))) {
      return res.status(400).json({ message: 'empresaId es obligatorio' });
    }

    if (!Number.isFinite(productoId)) {
      return res.status(400).json({ message: 'id de producto inválido' });
    }

    const catalogoIds = Array.isArray(catalogoIdsRaw)
      ? catalogoIdsRaw.map((v) => Number(v)).filter((v) => Number.isFinite(v))
      : [];

    await guardarCatalogosConfigurablesDeProducto(Number(empresaId), productoId, catalogoIds);
    res.json({ ok: true });
  } catch (error) {
    console.error('Error al guardar catálogos configurables de producto:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}
