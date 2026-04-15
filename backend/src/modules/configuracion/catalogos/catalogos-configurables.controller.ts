import { Request, Response } from 'express';
import { obtenerCatalogosConfigurables } from './catalogos-configurables.repository';

export async function listarCatalogosConfigurables(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;

    if (!empresaId || Number.isNaN(Number(empresaId))) {
      return res.status(400).json({ message: 'empresaId es obligatorio' });
    }

    const rows = await obtenerCatalogosConfigurables(Number(empresaId));

    const grouped = Object.values(
      rows.reduce<Record<string, { entidad_tipo_id: number; entidad_nombre: string | null; entidad_descripcion: string | null; catalogos: { id: number; nombre: string | null; descripcion: string | null; }[] }>>((acc, row) => {
        const key = String(row.entidad_tipo_id);
        if (!acc[key]) {
          acc[key] = {
            entidad_tipo_id: row.entidad_tipo_id,
            entidad_nombre: row.entidad_nombre,
            entidad_descripcion: row.entidad_descripcion,
            catalogos: [],
          };
        }

        acc[key].catalogos.push({
          id: row.catalogo_tipo_id,
          nombre: row.catalogo_nombre,
          descripcion: row.catalogo_descripcion,
        });
        return acc;
      }, {})
    ).map((item) => ({
      ...item,
      catalogos: item.catalogos.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')),
    }))
      .sort((a, b) => (a.entidad_nombre || '').localeCompare(b.entidad_nombre || ''));

    res.json(grouped);
  } catch (error) {
    console.error('Error al listar catálogos configurables:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}
