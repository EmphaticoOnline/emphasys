import { Request, Response } from 'express';
import { generarExcelBuffer } from '../../utils/exportar';
import type { ExportColumna } from '../../utils/exportar';
import { sanitizarRichTextBasico } from '../../utils/richTextSanitize';
import {
  getProductosRepository,
  getProductosPaginadosRepository,
  updateProductoRepository,
  deleteProductoRepository,
  insertarProductoRepository,
  getProductoByIdRepository,
  obtenerCatalogosConfigurablesDeProducto,
  guardarCatalogosConfigurablesDeProducto,
  listarProductoArchivosRepository,
  crearProductoArchivoRepository,
  eliminarProductoArchivoRepository,
  marcarProductoArchivoPrincipalRepository,
  listarExistenciasProductoRepository,
  listarDocumentosRelacionadosProductoRepository,
} from './productos.repository';
import { listarImpuestosProductoRepository, reemplazarImpuestosProductoRepository } from './productos.repository';
import { generarPdfPreviewSiFalta } from '../../services/pdfPreviewImage.service';
import { resolverContextoScopeComercial } from '../auth/scope-comercial';
import {
  omitirCamposEconomicos,
  omitirCamposEconomicosLista,
  filtrarCamposEconomicosDeEntrada,
  excluirColumnasEconomicas,
} from './productos.economic-fields';
import { listarHistorialContacto, listarHistorialProducto, type ProductoHistorialModo } from './producto-historial.repository';

async function resolverEsAdmin(req: Request, empresaId: number): Promise<boolean> {
  const { esAdmin } = await resolverContextoScopeComercial(
    empresaId,
    req.auth?.userId,
    req.auth?.esSuperadmin
  );
  return esAdmin;
}

function sanitizarPayloadProducto(body: any) {
  if (typeof body?.especificaciones === 'string') {
    return {
      ...body,
      especificaciones: sanitizarRichTextBasico(body.especificaciones),
    };
  }
  return body;
}

// Violación de unicidad de Postgres (código 23505). Usamos el mismo criterio
// que otros módulos del backend (roles, precios-listas, etc.): la única
// restricción única conocida sobre `productos` es (empresa_id, clave)
// (inferida por el uso de ON CONFLICT (empresa_id, clave) en
// productos.repository.ts). No se agrega detección por nombre de constraint
// porque no se pudo introspeccionar el catálogo real (BD remota compartida).
function esViolacionClaveDuplicada(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: string }).code === '23505');
}

// POST /api/productos
export async function crearProducto(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    if (!empresaId) {
      return res.status(400).json({ message: "empresaId no disponible en contexto" });
    }

    const esAdmin = await resolverEsAdmin(req, Number(empresaId));
    const payload = filtrarCamposEconomicosDeEntrada(sanitizarPayloadProducto(req.body), esAdmin);
    const producto = await insertarProductoRepository(payload, Number(empresaId));
    res.status(201).json(omitirCamposEconomicos(producto, esAdmin));
  } catch (error) {
    if (esViolacionClaveDuplicada(error)) {
      return res.status(409).json({ error: 'Ya existe un producto con esa clave' });
    }
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

    const pageRaw = req.query.page;
    const limitRaw = req.query.limit;
    const page = typeof pageRaw === 'string' ? Number(pageRaw) : undefined;
    const limit = typeof limitRaw === 'string' ? Number(limitRaw) : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;

    const esAdmin = await resolverEsAdmin(req, Number(empresaId));

    const usingPagination = Number.isFinite(page) && Number.isFinite(limit);
    if (usingPagination && page && page >= 1 && limit && limit >= 1 && limit <= 100) {
      const result = await getProductosPaginadosRepository(Number(empresaId), { page, limit, search });
      return res.json({ data: omitirCamposEconomicosLista(result.data, esAdmin), total: result.total, page, limit });
    }

    const productos = await getProductosRepository(Number(empresaId));
    res.json(omitirCamposEconomicosLista(productos, esAdmin));
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
    const esAdmin = await resolverEsAdmin(req, Number(empresaId));
    res.json(omitirCamposEconomicos(producto, esAdmin));
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener producto' });
  }
}

export async function getExistenciasProducto(req: Request, res: Response) {
  const empresaId = Number(req.context?.empresaId); const productoId = Number(req.params.id);
  if (!empresaId || !Number.isInteger(productoId)) return res.status(400).json({ message: 'Producto o empresa inválidos' });
  try { return res.json(await listarExistenciasProductoRepository(productoId, empresaId)); }
  catch (error) { console.error('Error al obtener existencias del producto', error); return res.status(500).json({ error: 'Error al obtener existencias del producto' }); }
}

export async function getDocumentosRelacionadosProducto(req: Request, res: Response) {
  const empresaId = Number(req.context?.empresaId); const productoId = Number(req.params.id);
  if (!empresaId || !Number.isInteger(productoId)) return res.status(400).json({ message: 'Producto o empresa inválidos' });
  try { return res.json(await listarDocumentosRelacionadosProductoRepository(productoId, empresaId)); }
  catch (error) { console.error('Error al obtener documentos del producto', error); return res.status(500).json({ error: 'Error al obtener documentos relacionados' }); }
}

function leerFechaProducto(query: Request['query'], nombre: string): string | undefined {
  const value = query[nombre];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${nombre} debe tener formato YYYY-MM-DD`);
  return value;
}

async function getHistorialComercial(req: Request, res: Response, modo: ProductoHistorialModo, entidad: 'producto' | 'contacto') {
  const empresaId = Number(req.context?.empresaId); const entidadId = Number(req.params.id);
  if (!empresaId || !Number.isInteger(entidadId)) return res.status(400).json({ error: entidad === 'producto' ? 'Producto o empresa inválidos' : 'Contacto o empresa inválidos' });
  try {
    const fechaInicio = leerFechaProducto(req.query, 'fecha_inicio'); const fechaFin = leerFechaProducto(req.query, 'fecha_fin');
    if (fechaInicio && fechaFin && fechaInicio > fechaFin) return res.status(400).json({ error: 'fecha_inicio no puede ser posterior a fecha_fin' });
    const limit = req.query.limit === undefined ? 50 : Number(req.query.limit); const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200 || !Number.isInteger(offset) || offset < 0) return res.status(400).json({ error: 'limit debe estar entre 1 y 200; offset debe ser un entero no negativo' });
    const params = { empresaId, fechaInicio, fechaFin, limit, offset };
    return res.json(entidad === 'producto'
      ? await listarHistorialProducto(modo, { ...params, productoId: entidadId })
      : await listarHistorialContacto(modo, { ...params, contactoId: entidadId }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al obtener historial';
    if (message.includes('debe tener formato')) return res.status(400).json({ error: message });
    console.error(`Error al obtener historial de ${modo} del ${entidad}`, error); return res.status(500).json({ error: `Error al obtener últimas ${modo} del ${entidad}` });
  }
}

export const getUltimasComprasProducto = (req: Request, res: Response) => getHistorialComercial(req, res, 'compras', 'producto');
export const getUltimasVentasProducto = (req: Request, res: Response) => getHistorialComercial(req, res, 'ventas', 'producto');
export const getUltimasComprasContacto = (req: Request, res: Response) => getHistorialComercial(req, res, 'compras', 'contacto');
export const getUltimasVentasContacto = (req: Request, res: Response) => getHistorialComercial(req, res, 'ventas', 'contacto');

export async function getImpuestosProducto(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    const productoId = Number(req.params.id);
    if (!empresaId || !Number.isInteger(productoId)) return res.status(400).json({ message: 'Producto o empresa inválidos' });
    res.json(await listarImpuestosProductoRepository(productoId, Number(empresaId)));
  } catch (error) {
    console.error('Error al obtener impuestos del producto', error);
    res.status(500).json({ message: 'Error al obtener impuestos del producto' });
  }
}

export async function putImpuestosProducto(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    const productoId = Number(req.params.id);
    const impuestoIds = req.body?.impuesto_ids;
    if (!empresaId || !Number.isInteger(productoId) || !Array.isArray(impuestoIds)) {
      return res.status(400).json({ message: 'Producto, empresa e impuesto_ids son obligatorios' });
    }
    const result = await reemplazarImpuestosProductoRepository(productoId, Number(empresaId), impuestoIds);
    if (!result) return res.status(404).json({ message: 'Producto no encontrado para la empresa activa' });
    res.json(result);
  } catch (error) {
    console.error('Error al guardar impuestos del producto', error);
    const message = error instanceof Error ? error.message : 'Error al guardar impuestos del producto';
    res.status(400).json({ message });
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

    const esAdmin = await resolverEsAdmin(req, Number(empresaId));
    const payload = filtrarCamposEconomicosDeEntrada(sanitizarPayloadProducto(req.body), esAdmin);
    const producto = await updateProductoRepository(id, payload, Number(empresaId));
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(omitirCamposEconomicos(producto, esAdmin));
  } catch (error) {
    if (esViolacionClaveDuplicada(error)) {
      return res.status(409).json({ error: 'Ya existe un producto con esa clave' });
    }
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
    const esAdmin = await resolverEsAdmin(req, Number(empresaId));
    res.json(omitirCamposEconomicos(producto, esAdmin));
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

export async function listarProductoArchivos(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    const productoId = Number(req.params.productoId);

    if (!empresaId) {
      return res.status(400).json({ message: 'empresaId no disponible en contexto' });
    }

    if (!Number.isFinite(productoId)) {
      return res.status(400).json({ message: 'productoId inválido' });
    }

    const archivos = await listarProductoArchivosRepository(productoId, Number(empresaId));
    return res.json(archivos);
  } catch (error) {
    console.error('Error al listar archivos de producto:', error);
    return res.status(500).json({ message: 'Error al listar archivos del producto' });
  }
}

export async function crearProductoArchivo(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    const productoId = Number(req.params.productoId);
    const descripcion = typeof req.body?.descripcion === 'string' ? req.body.descripcion.trim() : null;

    if (!empresaId) {
      return res.status(400).json({ message: 'empresaId no disponible en contexto' });
    }

    if (!Number.isFinite(productoId)) {
      return res.status(400).json({ message: 'productoId inválido' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Archivo no enviado' });
    }

    const rutaArchivo = `/uploads/productos/${req.file.filename}`;
    const archivo = await crearProductoArchivoRepository(productoId, Number(empresaId), {
      archivo: rutaArchivo,
      descripcion,
      tipo_archivo: 'imagen',
    });

    // Síncrono y best-effort: si Sharp falla aquí, la subida del original
    // igual se considera exitosa; la primera impresión que use esta imagen
    // generará la versión optimizada de forma perezosa.
    await generarPdfPreviewSiFalta(rutaArchivo);

    return res.status(201).json(archivo);
  } catch (error) {
    if (error instanceof Error && error.message === 'PRODUCTO_NOT_FOUND') {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    console.error('Error al crear archivo de producto:', error);
    return res.status(500).json({ message: 'Error al crear archivo del producto' });
  }
}

export async function eliminarProductoArchivo(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    const archivoId = Number(req.params.archivoId);

    if (!empresaId) {
      return res.status(400).json({ message: 'empresaId no disponible en contexto' });
    }

    if (!Number.isFinite(archivoId)) {
      return res.status(400).json({ message: 'archivoId inválido' });
    }

    const archivo = await eliminarProductoArchivoRepository(archivoId, Number(empresaId));
    if (!archivo) {
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('Error al eliminar archivo de producto:', error);
    return res.status(500).json({ message: 'Error al eliminar archivo del producto' });
  }
}

export async function exportarProductos(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    if (!empresaId) return res.status(400).json({ message: 'empresaId no disponible en contexto' });

    const { filters = {}, columns } = req.body as { filters: Record<string, any>; columns: ExportColumna[] };

    if (!Array.isArray(columns) || columns.length === 0) {
      return res.status(400).json({ message: 'columns es obligatorio' });
    }

    const esAdmin = await resolverEsAdmin(req, Number(empresaId));

    const exportColumns = excluirColumnasEconomicas(
      columns
        .filter((c) => c && typeof c.field === 'string' && typeof c.headerName === 'string')
        .slice(0, 50),
      esAdmin
    );

    if (exportColumns.length === 0) {
      return res.status(400).json({ message: 'No hay columnas válidas para exportar' });
    }

    const search = typeof filters.search === 'string' ? filters.search.trim().toLowerCase() : '';

    let productos: Record<string, any>[] = omitirCamposEconomicosLista(
      await getProductosRepository(Number(empresaId)),
      esAdmin
    );

    if (search) {
      productos = productos.filter((p) =>
        [p['clave'], p['descripcion']]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(search))
      );
    }

    const buffer = generarExcelBuffer(productos, exportColumns, 'Productos');
    const fecha = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="productos-${fecha}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    console.error('Error al exportar productos:', error);
    res.status(500).json({ message: 'Error al exportar productos' });
  }
}

export async function marcarProductoArchivoPrincipal(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    const archivoId = Number(req.params.archivoId);

    if (!empresaId) {
      return res.status(400).json({ message: 'empresaId no disponible en contexto' });
    }

    if (!Number.isFinite(archivoId)) {
      return res.status(400).json({ message: 'archivoId inválido' });
    }

    const archivo = await marcarProductoArchivoPrincipalRepository(archivoId, Number(empresaId));
    if (!archivo) {
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }

    return res.json(archivo);
  } catch (error) {
    console.error('Error al marcar archivo principal de producto:', error);
    return res.status(500).json({ message: 'Error al actualizar archivo principal del producto' });
  }
}
