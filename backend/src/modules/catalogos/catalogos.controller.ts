import { Request, Response } from 'express';
import {
  obtenerCatalogosPorTipo,
  crearCatalogoValor,
  actualizarCatalogoValor,
  obtenerCatalogoTipoNombre,
  listarCatalogosTipos,
  catalogoEstaEnUso,
  eliminarCatalogoValor,
  obtenerCatalogosPorTipoFlexible,
  CatalogoJerarquiaError,
} from './catalogos.repository';

export async function listarCatalogos(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    const tipoCatalogoId = Number(req.query.tipo_catalogo_id);

    if (!empresaId) return res.status(400).json({ message: 'empresaId es obligatorio' });
    if (!tipoCatalogoId) return res.status(400).json({ message: 'tipo_catalogo_id es obligatorio' });

    const data = await obtenerCatalogosPorTipo(Number(empresaId), tipoCatalogoId);
    res.json(data);
  } catch (error) {
    console.error('Error al listar catálogos:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

export async function obtenerCatalogoTipo(req: Request, res: Response) {
  try {
    const tipoCatalogoId = Number(req.params.id);
    if (!tipoCatalogoId) return res.status(400).json({ message: 'tipo_catalogo_id es obligatorio' });

    const nombre = await obtenerCatalogoTipoNombre(tipoCatalogoId);
    if (!nombre) return res.status(404).json({ message: 'Tipo de catálogo no encontrado' });

    res.json({ id: tipoCatalogoId, nombre });
  } catch (error) {
    console.error('Error al obtener tipo de catálogo:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

export async function obtenerCatalogosTipos(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    if (!empresaId) return res.status(400).json({ message: 'empresaId es obligatorio' });

    const data = await listarCatalogosTipos(empresaId);
    res.json(data);
  } catch (error) {
    console.error('Error al listar tipos de catálogo:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

export async function crearCatalogo(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    if (!empresaId) return res.status(400).json({ message: 'empresaId es obligatorio' });

    const { tipo_catalogo_id, descripcion } = req.body;
    if (!tipo_catalogo_id) return res.status(400).json({ message: 'tipo_catalogo_id es obligatorio' });
    if (!descripcion || String(descripcion).trim() === '') {
      return res.status(400).json({ message: 'descripcion es obligatoria' });
    }

    const nuevo = await crearCatalogoValor(Number(empresaId), {
      ...req.body,
      descripcion: String(descripcion).trim(),
    });
    res.status(201).json(nuevo);
  } catch (error) {
    if (error instanceof CatalogoJerarquiaError) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error('Error al crear catálogo:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

export async function actualizarCatalogo(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    const id = Number(req.params.id);
    if (!empresaId) return res.status(400).json({ message: 'empresaId es obligatorio' });
    if (!id) return res.status(400).json({ message: 'id es obligatorio' });

    if ('descripcion' in req.body && String(req.body.descripcion).trim() === '') {
      return res.status(400).json({ message: 'descripcion es obligatoria' });
    }

    const actualizado = await actualizarCatalogoValor(Number(empresaId), id, req.body);
    if (!actualizado) return res.status(404).json({ message: 'Registro no encontrado' });

    res.json(actualizado);
  } catch (error) {
    if (error instanceof CatalogoJerarquiaError) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error('Error al actualizar catálogo:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

export async function eliminarCatalogo(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    const id = Number(req.params.id);
    if (!empresaId) return res.status(400).json({ message: 'empresaId es obligatorio' });
    if (!id) return res.status(400).json({ message: 'id es obligatorio' });

    const enUso = await catalogoEstaEnUso(id);
    if (enUso) {
      return res.status(400).json({
        message:
          'Este elemento del catálogo ya está siendo utilizado y no puede eliminarse. Puede desactivarlo si desea que no vuelva a utilizarse.',
      });
    }

    const eliminado = await eliminarCatalogoValor(Number(empresaId), id);
    if (!eliminado) return res.status(404).json({ message: 'Registro no encontrado' });

    res.json(eliminado);
  } catch (error) {
    console.error('Error al eliminar catálogo:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

export async function listarCatalogosPorTipoFlexible(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    const tipo = String(req.params.tipo);
    const parentIdRaw = req.query.parent_id;

    if (!empresaId) return res.status(400).json({ message: 'empresaId es obligatorio' });
    if (!tipo) return res.status(400).json({ message: 'tipo de catálogo es obligatorio' });

    const parentId = parentIdRaw === undefined ? undefined : Number(parentIdRaw);
    if (parentIdRaw !== undefined && Number.isNaN(parentId)) {
      return res.status(400).json({ message: 'parent_id debe ser numérico' });
    }

    const tipoCatalogo = /^\d+$/.test(tipo) ? Number(tipo) : tipo;
    const data = await obtenerCatalogosPorTipoFlexible(Number(empresaId), tipoCatalogo, parentId ?? null);
    res.json(data);
  } catch (error) {
    console.error('Error al listar catálogo dependiente:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}
