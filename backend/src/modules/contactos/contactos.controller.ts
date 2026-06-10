import { Request, Response } from "express";
import {
  obtenerContactos,
  obtenerContactosPaginados,
  obtenerContactosParaExportar,
  insertarContacto,
  actualizarContacto as actualizarContactoRepository,
  obtenerContactoPorId,
  eliminarContacto as eliminarContactoRepository,
  obtenerCatalogosConfigurablesDeContacto,
  guardarCatalogosConfigurablesDeContacto,
  precioListaPerteneceAEmpresa,
} from "./contactos.repository";
import { generarExcelBuffer } from "../../utils/exportar";
import type { ExportColumna } from "../../utils/exportar";
import { normalizarTelefono } from "../../utils/telefono";
import { normalizeRFC } from "../../shared/normalizers/rfc";
import { normalizeEmail } from "../../shared/normalizers/email";

const normalizeTelefonoContacto = (value: any) => {
  if (value === undefined || value === null || String(value).trim() === "") return null;

  const rawValue = String(value);
  const digits = rawValue.replace(/\D/g, '');

  if (digits.startsWith('521') && digits.length === 13) {
    return digits;
  }

  if (digits.startsWith('52') && digits.length === 12) {
    return `521${digits.slice(-10)}`;
  }

  if (digits.length === 10) {
    return `521${digits}`;
  }

  return normalizarTelefono(rawValue);
};

const normalizeOptionalText = (value: any, maxLength?: number) => {
  if (value === undefined) return undefined;
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  return maxLength ? trimmed.slice(0, maxLength) : trimmed;
};

export async function crearContacto(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;

    if (empresaId === undefined || empresaId === null || Number.isNaN(Number(empresaId))) {
      return res.status(400).json({ message: "empresaId es obligatorio" });
    }

    if (!req.body.nombre || String(req.body.nombre).trim() === "") {
      return res.status(400).json({ message: "nombre es obligatorio" });
    }

    const data = { ...req.body };

    data.nombre = String(data.nombre).trim();
    if ('nombre_contacto' in data) {
      data.nombre_contacto = String(data.nombre_contacto ?? '').trim() || null;
    }

    if ('interes_inicial' in data) {
      data.interes_inicial = normalizeOptionalText(data.interes_inicial, 500);
    }

    if ('observaciones' in data) {
      data.observaciones = normalizeOptionalText(data.observaciones);
    }

    const telefonoRecibido = "telefono" in data ? data.telefono : undefined;

    if ("telefono" in data) {
      data.telefono = normalizeTelefonoContacto(data.telefono);
      console.log('[Contactos] Telefono normalizado', {
        telefonoRecibido,
        telefonoGuardado: data.telefono,
      });
    }

    if ("telefono_secundario" in data) {
      data.telefono_secundario = normalizeTelefonoContacto(data.telefono_secundario);
    }

    if ("rfc" in data) {
      data.rfc = normalizeRFC(data.rfc);
    }

    if ("email" in data) {
      data.email = normalizeEmail(data.email);
    }

    if (data.precio_lista_id !== undefined && data.precio_lista_id !== null && String(data.precio_lista_id).trim() !== '') {
      const precioListaId = Number(data.precio_lista_id);
      if (!Number.isFinite(precioListaId)) {
        return res.status(400).json({ message: 'precio_lista_id debe ser numérico' });
      }
      const valida = await precioListaPerteneceAEmpresa(Number(empresaId), precioListaId);
      if (!valida) {
        return res.status(400).json({ message: 'La lista de precios específica no existe, no pertenece a la empresa o no está activa.' });
      }
      data.precio_lista_id = precioListaId;
    } else if (data.precio_lista_id === '') {
      data.precio_lista_id = null;
    }

    const contacto = await insertarContacto(data, Number(empresaId));

    res.status(201).json(contacto);
  } catch (error) {
    console.error("Error al crear contacto:", error);
    if (error instanceof Error && error.message.includes('teléfono')) {
      return res.status(400).json({ message: error.message });
    }
    if (error instanceof Error && error.message === 'CP_SAT_NO_ENCONTRADO') {
      return res.status(400).json({ message: "El código postal SAT no existe" });
    }
    res.status(500).json({ message: "Error interno del servidor" });
  }
}

export const getContactos = async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId;

    if (empresaId === undefined || empresaId === null || Number.isNaN(Number(empresaId))) {
      return res.status(400).json({ message: "empresaId es obligatorio" });
    }

  const tiposRaw = req.query.tipos;
    const tipos = typeof tiposRaw === 'string'
      ? tiposRaw
          .split(',')
          .map((tipo) => tipo.trim())
          .filter(Boolean)
      : undefined;

  const searchRaw = req.query.search;
  const search = typeof searchRaw === 'string' ? searchRaw.trim() : undefined;

    const origenContactoIdRaw = req.query.origen_contacto_id;
    const vendedorIdRaw = req.query.vendedor_id;
    const activoRaw = req.query.activo;
    const fechaAltaDesdeRaw = req.query.fecha_alta_desde;
    const fechaAltaHastaRaw = req.query.fecha_alta_hasta;
    const interesInicialRaw = req.query.interes_inicial;
    const observacionesRaw = req.query.observaciones;

    const origenContactoId = typeof origenContactoIdRaw === 'string' && origenContactoIdRaw.trim() !== ''
      ? Number(origenContactoIdRaw)
      : undefined;
    const vendedorId = typeof vendedorIdRaw === 'string' && vendedorIdRaw.trim() !== ''
      ? Number(vendedorIdRaw)
      : undefined;
    const activo = activoRaw === 'activos' || activoRaw === 'inactivos' || activoRaw === 'todos'
      ? activoRaw
      : undefined;
    const fechaAltaDesde = typeof fechaAltaDesdeRaw === 'string' ? fechaAltaDesdeRaw.trim() : undefined;
    const fechaAltaHasta = typeof fechaAltaHastaRaw === 'string' ? fechaAltaHastaRaw.trim() : undefined;
    const interesInicial = typeof interesInicialRaw === 'string' ? interesInicialRaw.trim() : undefined;
    const observaciones = typeof observacionesRaw === 'string' ? observacionesRaw.trim() : undefined;

    const pageRaw = req.query.page;
    const limitRaw = req.query.limit;
    const page = typeof pageRaw === 'string' ? Number(pageRaw) : undefined;
    const limit = typeof limitRaw === 'string' ? Number(limitRaw) : undefined;

    const usingPagination = Number.isFinite(page) && Number.isFinite(limit);
    if (usingPagination) {
      if (!page || page < 1 || !limit || limit < 1 || limit > 100) {
        return res.status(400).json({ message: 'page y limit deben ser válidos (1-100)' });
      }

      if (origenContactoId !== undefined && !Number.isFinite(origenContactoId)) {
        return res.status(400).json({ message: 'origen_contacto_id debe ser numérico' });
      }

      if (vendedorId !== undefined && !Number.isFinite(vendedorId)) {
        return res.status(400).json({ message: 'vendedor_id debe ser numérico' });
      }

      const result = await obtenerContactosPaginados(Number(empresaId), tipos, page, limit, search, {
        origenContactoId,
        vendedorId,
        activo,
        fechaAltaDesde,
        fechaAltaHasta,
        interesInicial,
        observaciones,
      });
      return res.json({ data: result.data, total: result.total, page, limit });
    }

    const result = await obtenerContactos(Number(empresaId), tipos);
    res.json(result);
  } catch (error) {
    console.error("Error al obtener contactos:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export async function getContactoPorId(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const empresaId = req.context?.empresaId;

    if (Number.isNaN(id) || empresaId === undefined || empresaId === null || Number.isNaN(Number(empresaId))) {
      return res.status(400).json({ message: "id y empresaId son obligatorios" });
    }

    const contacto = await obtenerContactoPorId(id, Number(empresaId));

    if (!contacto) {
      return res.status(404).json({ message: "Contacto no encontrado" });
    }

    res.json(contacto);
  } catch (error) {
    console.error("Error al obtener contacto:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
}

export async function actualizarContacto(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    const data = { ...req.body };

    const telefonoRecibido = "telefono" in data ? data.telefono : undefined;

    if (empresaId === undefined || empresaId === null || Number.isNaN(Number(empresaId))) {
      return res.status(400).json({ message: "empresaId es obligatorio" });
    }

    if ('nombre' in data) {
      data.nombre = String(data.nombre ?? '').trim();
    }

    if ('nombre_contacto' in data) {
      data.nombre_contacto = String(data.nombre_contacto ?? '').trim() || null;
    }

    if ('interes_inicial' in data) {
      data.interes_inicial = normalizeOptionalText(data.interes_inicial, 500);
    }

    if ('observaciones' in data) {
      data.observaciones = normalizeOptionalText(data.observaciones);
    }

    if ("telefono" in data) {
      data.telefono = normalizeTelefonoContacto(data.telefono);
      console.log('[Contactos] Telefono normalizado', {
        telefonoRecibido,
        telefonoGuardado: data.telefono,
      });
    }

    if ("telefono_secundario" in data) {
      data.telefono_secundario = normalizeTelefonoContacto(data.telefono_secundario);
    }

    if ("rfc" in data) {
      data.rfc = normalizeRFC(data.rfc);
    }

    if ("email" in data) {
      data.email = normalizeEmail(data.email);
    }

    if (data.precio_lista_id !== undefined && data.precio_lista_id !== null && String(data.precio_lista_id).trim() !== '') {
      const precioListaId = Number(data.precio_lista_id);
      if (!Number.isFinite(precioListaId)) {
        return res.status(400).json({ message: 'precio_lista_id debe ser numérico' });
      }
      const valida = await precioListaPerteneceAEmpresa(Number(empresaId), precioListaId);
      if (!valida) {
        return res.status(400).json({ message: 'La lista de precios específica no existe, no pertenece a la empresa o no está activa.' });
      }
      data.precio_lista_id = precioListaId;
    } else if (data.precio_lista_id === null || data.precio_lista_id === '') {
      data.precio_lista_id = null;
    }

    const contacto = await actualizarContactoRepository(id, Number(empresaId), data);
    res.json(contacto);
  } catch (error) {
    console.error("Error al actualizar contacto:", error);
    if (error instanceof Error && error.message.includes('teléfono')) {
      return res.status(400).json({ message: error.message });
    }
    if (error instanceof Error && error.message === 'CP_SAT_NO_ENCONTRADO') {
      return res.status(400).json({ message: "El código postal SAT no existe" });
    }
    res.status(500).json({ message: "Error interno del servidor" });
  }
}

export async function eliminarContacto(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const empresaId = req.context?.empresaId;

    if (Number.isNaN(id) || empresaId === undefined || empresaId === null || Number.isNaN(Number(empresaId))) {
      return res.status(400).json({ message: "id y empresaId son obligatorios" });
    }

    const eliminado = await eliminarContactoRepository(id, Number(empresaId));

    if (!eliminado) {
      return res.status(404).json({ message: "Contacto no encontrado" });
    }

    res.json(eliminado);
  } catch (error) {
    console.error("Error al eliminar contacto:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
}

export async function listarCatalogosConfigurablesDeContacto(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    const contactoIdRaw = req.query.contactoId;

    if (empresaId === undefined || empresaId === null || Number.isNaN(Number(empresaId))) {
      return res.status(400).json({ message: "empresaId es obligatorio" });
    }

    const contactoId = contactoIdRaw !== undefined ? Number(contactoIdRaw) : undefined;

    if (contactoIdRaw !== undefined && !Number.isFinite(contactoId)) {
      return res.status(400).json({ message: "contactoId debe ser numérico" });
    }

    const payload = await obtenerCatalogosConfigurablesDeContacto(Number(empresaId), contactoId);
    res.json(payload);
  } catch (error) {
    console.error("Error al obtener catálogos configurables de contacto:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
}

export async function exportarContactos(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    if (empresaId === undefined || empresaId === null || Number.isNaN(Number(empresaId))) {
      return res.status(400).json({ message: "empresaId es obligatorio" });
    }

    const { filters = {}, columns } = req.body as { filters: Record<string, any>; columns: ExportColumna[] };

    if (!Array.isArray(columns) || columns.length === 0) {
      return res.status(400).json({ message: "columns es obligatorio" });
    }

    const exportColumns = columns
      .filter((c) => c && typeof c.field === 'string' && typeof c.headerName === 'string')
      .slice(0, 50);

    if (exportColumns.length === 0) {
      return res.status(400).json({ message: "No hay columnas válidas para exportar" });
    }

    const tiposRaw = filters.tipos;
    const tipos = Array.isArray(tiposRaw)
      ? (tiposRaw as string[]).filter(Boolean)
      : typeof tiposRaw === 'string'
        ? tiposRaw.split(',').map((t: string) => t.trim()).filter(Boolean)
        : undefined;

    const search = typeof filters.search === 'string' ? filters.search.trim() : undefined;
    const activo =
      filters.activo === 'activos' || filters.activo === 'inactivos' || filters.activo === 'todos'
        ? filters.activo
        : undefined;
    const origenContactoId =
      filters.origenContactoId != null ? Number(filters.origenContactoId) : undefined;
    const vendedorId =
      filters.vendedorId != null ? Number(filters.vendedorId) : undefined;
    const fechaAltaDesde =
      typeof filters.fechaAltaDesde === 'string' ? filters.fechaAltaDesde.trim() : undefined;
    const fechaAltaHasta =
      typeof filters.fechaAltaHasta === 'string' ? filters.fechaAltaHasta.trim() : undefined;
    const interesInicial =
      typeof filters.interesInicial === 'string' ? filters.interesInicial.trim() : undefined;
    const observaciones =
      typeof filters.observaciones === 'string' ? filters.observaciones.trim() : undefined;

    const contactos = await obtenerContactosParaExportar(Number(empresaId), tipos, search, {
      origenContactoId: Number.isFinite(origenContactoId) ? origenContactoId : undefined,
      vendedorId: Number.isFinite(vendedorId) ? vendedorId : undefined,
      activo,
      fechaAltaDesde,
      fechaAltaHasta,
      interesInicial,
      observaciones,
    });

    const buffer = generarExcelBuffer(contactos, exportColumns, 'Contactos');

    const fecha = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="contactos-${fecha}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    console.error("Error al exportar contactos:", error);
    res.status(500).json({ message: "Error al exportar contactos" });
  }
}

export async function guardarCatalogosConfigurables(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    const contactoId = Number(req.params.id);
    const catalogoIdsRaw = req.body?.catalogoIds;

    if (empresaId === undefined || empresaId === null || Number.isNaN(Number(empresaId))) {
      return res.status(400).json({ message: "empresaId es obligatorio" });
    }

    if (!Number.isFinite(contactoId)) {
      return res.status(400).json({ message: "id de contacto inválido" });
    }

    const catalogoIds = Array.isArray(catalogoIdsRaw)
      ? catalogoIdsRaw.map((v) => Number(v)).filter((v) => Number.isFinite(v))
      : [];

    await guardarCatalogosConfigurablesDeContacto(Number(empresaId), contactoId, catalogoIds);
    res.json({ ok: true });
  } catch (error) {
    console.error("Error al guardar catálogos configurables de contacto:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
}