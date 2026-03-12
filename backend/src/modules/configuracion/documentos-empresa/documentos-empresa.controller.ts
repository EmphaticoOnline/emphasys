import { Request, Response } from 'express';
import {
  DocumentoEmpresa,
  TransicionDocumento,
  documentoEstaHabilitado,
  existeTipoDocumento,
  obtenerDocumentosActivosEmpresa,
  obtenerDocumentosEmpresa,
  obtenerTransicionesEmpresa,
  upsertDocumentoEmpresa,
  upsertTransicionDocumento,
} from './documentos-empresa.repository';

function ensureEmpresa(req: Request): number | null {
  const empresaId = req.context?.empresaId;
  if (!empresaId) return null;
  return empresaId;
}

export async function listarDocumentosEmpresa(req: Request, res: Response) {
  try {
    const empresaId = ensureEmpresa(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa no disponible en el contexto' });

    const documentos = await obtenerDocumentosEmpresa(empresaId);
    return res.json(documentos);
  } catch (error) {
    console.error('Error al listar documentos de la empresa:', error);
    return res.status(500).json({ message: 'Error interno al listar documentos' });
  }
}

export async function actualizarDocumentoEmpresa(req: Request, res: Response) {
  try {
    const empresaId = ensureEmpresa(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa no disponible en el contexto' });

    const tipoDocumentoId = Number(req.params.tipoDocumentoId ?? req.body?.tipo_documento_id);
    if (!Number.isFinite(tipoDocumentoId)) return res.status(400).json({ message: 'tipo_documento_id inválido' });

    const { activo } = req.body || {};
    if (activo === undefined) return res.status(400).json({ message: 'El campo activo es obligatorio' });

    const tipoExiste = await existeTipoDocumento(tipoDocumentoId);
    if (!tipoExiste) return res.status(404).json({ message: 'Tipo de documento no encontrado o inactivo' });

    const actualizado = await upsertDocumentoEmpresa(empresaId, tipoDocumentoId, Boolean(activo));
    if (!actualizado) return res.status(500).json({ message: 'No se pudo actualizar el documento' });

    return res.json(actualizado);
  } catch (error) {
    console.error('Error al actualizar documento de empresa:', error);
    return res.status(500).json({ message: 'Error interno al actualizar' });
  }
}

export async function obtenerFlujoDocumentos(req: Request, res: Response) {
  try {
    const empresaId = ensureEmpresa(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa no disponible en el contexto' });

    const documentos = await obtenerDocumentosActivosEmpresa(empresaId);
    const transicionesDb = await obtenerTransicionesEmpresa(empresaId);

    const idsActivos = new Set(documentos.map((d) => d.id));
    const transiciones: TransicionDocumento[] = transicionesDb.filter(
      (t) =>
        t.tipo_documento_origen_id !== t.tipo_documento_destino_id &&
        idsActivos.has(t.tipo_documento_origen_id) &&
        idsActivos.has(t.tipo_documento_destino_id)
    );

    return res.json({ documentos, transiciones });
  } catch (error) {
    console.error('Error al obtener flujo de documentos:', error);
    return res.status(500).json({ message: 'Error interno al obtener el flujo' });
  }
}

export async function actualizarTransicionDocumento(req: Request, res: Response) {
  try {
    const empresaId = ensureEmpresa(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa no disponible en el contexto' });

    const origenId = Number(req.body?.tipo_documento_origen_id ?? req.body?.origenId);
    const destinoId = Number(req.body?.tipo_documento_destino_id ?? req.body?.destinoId);
    const { activo } = req.body || {};

    if (!Number.isFinite(origenId) || !Number.isFinite(destinoId)) {
      return res.status(400).json({ message: 'Los IDs de origen y destino deben ser numéricos' });
    }
    if (origenId === destinoId) {
      return res.status(400).json({ message: 'No se permiten transiciones con el mismo origen y destino' });
    }
    if (activo === undefined) {
      return res.status(400).json({ message: 'El campo activo es obligatorio' });
    }

    const [origenHabilitado, destinoHabilitado] = await Promise.all([
      documentoEstaHabilitado(empresaId, origenId),
      documentoEstaHabilitado(empresaId, destinoId),
    ]);

    if (!origenHabilitado || !destinoHabilitado) {
      return res.status(400).json({ message: 'Ambos documentos deben estar habilitados para la empresa' });
    }

    const transicion = await upsertTransicionDocumento(empresaId, origenId, destinoId, Boolean(activo));
    if (!transicion) return res.status(500).json({ message: 'No se pudo guardar la transición' });

    return res.json(transicion);
  } catch (error) {
    console.error('Error al actualizar transición de documento:', error);
    return res.status(500).json({ message: 'Error interno al guardar la transición' });
  }
}