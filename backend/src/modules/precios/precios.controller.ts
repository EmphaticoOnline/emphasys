import { Request, Response } from 'express';
import {
  guardarPreciosBatchRepository,
  obtenerPreciosCapturaRepository,
  resolverPrecioDocumentoRepository,
  type PrecioBatchItem,
} from './precios.repository';

function getEmpresaId(req: Request): number | null {
  const empresaId = req.context?.empresaId;
  return Number.isFinite(Number(empresaId)) ? Number(empresaId) : null;
}

export async function getPreciosCaptura(req: Request, res: Response) {
  const empresaId = getEmpresaId(req);
  if (!empresaId) {
    return res.status(400).json({ message: 'empresaId es obligatorio' });
  }

  try {
    const payload = await obtenerPreciosCapturaRepository(empresaId, {
      clave: typeof req.query.clave === 'string' ? req.query.clave : undefined,
      descripcion: typeof req.query.descripcion === 'string' ? req.query.descripcion : undefined,
      clasificacion: typeof req.query.clasificacion === 'string' ? req.query.clasificacion : undefined,
      familia: typeof req.query.familia === 'string' ? req.query.familia : undefined,
    });

    return res.json(payload);
  } catch (error) {
    console.error('[precios] error al cargar captura', error);
    return res.status(500).json({ message: 'Error al cargar la captura masiva de precios' });
  }
}

export async function putPreciosBatch(req: Request, res: Response) {
  const empresaId = getEmpresaId(req);
  if (!empresaId) {
    return res.status(400).json({ message: 'empresaId es obligatorio' });
  }

  const rawItems: unknown[] | null = Array.isArray(req.body?.items) ? req.body.items : null;
  if (!rawItems) {
    return res.status(400).json({ message: 'items debe ser un arreglo' });
  }

  try {
    const items: PrecioBatchItem[] = rawItems.map((item: unknown) => {
      const rawItem = item as Record<string, unknown>;
      const productoId = Number(rawItem?.producto_id);
      const precioListaId = Number(rawItem?.precio_lista_id);
      const precioRaw = rawItem?.precio;

      if (!Number.isFinite(productoId) || !Number.isFinite(precioListaId)) {
        throw new Error('producto_id y precio_lista_id deben ser numéricos');
      }

      if (precioRaw === null || precioRaw === undefined || precioRaw === '') {
        return {
          producto_id: productoId,
          precio_lista_id: precioListaId,
          precio: null,
        };
      }

      const precio = Number(precioRaw);
      if (!Number.isFinite(precio) || precio < 0) {
        throw new Error('Cada precio debe ser numérico y mayor o igual a cero');
      }

      return {
        producto_id: productoId,
        precio_lista_id: precioListaId,
        precio,
      };
    });

    const result = await guardarPreciosBatchRepository(empresaId, items);
    return res.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo guardar el batch de precios';
    return res.status(400).json({ message });
  }
}

export async function getPrecioDocumento(req: Request, res: Response) {
  const empresaId = getEmpresaId(req);
  if (!empresaId) {
    return res.status(400).json({ message: 'empresaId es obligatorio' });
  }

  const productoId = Number(req.query.producto_id);
  const contactoIdRaw = req.query.contacto_id;
  const contactoId = contactoIdRaw === undefined || contactoIdRaw === null || contactoIdRaw === ''
    ? null
    : Number(contactoIdRaw);

  if (!Number.isFinite(productoId)) {
    return res.status(400).json({ message: 'producto_id debe ser numérico' });
  }

  if (contactoIdRaw !== undefined && contactoIdRaw !== null && contactoIdRaw !== '' && !Number.isFinite(contactoId)) {
    return res.status(400).json({ message: 'contacto_id debe ser numérico' });
  }

  try {
    const result = await resolverPrecioDocumentoRepository(empresaId, productoId, contactoId);
    return res.json(result);
  } catch (error) {
    console.error('[precios] error al resolver precio de documento', error);
    return res.status(500).json({ message: 'Error al resolver el precio del documento' });
  }
}