import { Request, Response } from 'express';
import { DOCUMENT_LAYOUTS, type DocumentLayout } from '../../../config/document-layouts';
import {
  actualizarLayoutConfiguracion,
  asignarLayoutASerie,
  crearLayoutConfiguracion,
  listarSeriesDocumento,
  obtenerLayoutEmpresa,
  obtenerLayoutSerie,
  obtenerSerieDocumento,
} from './formatos-impresion.repository';

type LayoutSource = 'serie' | 'empresa' | 'default';

const obtenerLayoutFallback = (tipoDocumento: string): DocumentLayout => {
  const tipo = (tipoDocumento ?? '').toString().toLowerCase();
  return (
    DOCUMENT_LAYOUTS[tipo as keyof typeof DOCUMENT_LAYOUTS] ?? {
      mostrarHeader: true,
      mostrarCliente: true,
      mostrarPartidas: true,
      mostrarTotales: true,
    }
  );
};

function ensureEmpresa(req: Request): number | null {
  const empresaId = req.context?.empresaId;
  if (!empresaId) return null;
  return empresaId;
}

export async function obtenerLayoutConfiguracion(req: Request, res: Response) {
  try {
    const empresaId = ensureEmpresa(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa no disponible en el contexto' });

    const tipoDocumento = (req.query?.tipo_documento ?? '').toString().toLowerCase();
    if (!tipoDocumento) return res.status(400).json({ message: 'tipo_documento es obligatorio' });

    const serie = (req.query?.serie ?? '').toString().trim();
    const includeSeries = ['1', 'true', 'yes'].includes((req.query?.includeSeries ?? '').toString().toLowerCase());

    const baseLayout = obtenerLayoutFallback(tipoDocumento);
    let source: LayoutSource = 'default';
    let layout = baseLayout;

    if (serie) {
      const serieLayout = await obtenerLayoutSerie(empresaId, tipoDocumento, serie);
      if (serieLayout?.configuracion && typeof serieLayout.configuracion === 'object') {
        layout = { ...baseLayout, ...(serieLayout.configuracion as Record<string, any>) };
        source = 'serie';
      }
    }

    if (source === 'default') {
      const empresaLayout = await obtenerLayoutEmpresa(empresaId, tipoDocumento);
      if (empresaLayout?.configuracion && typeof empresaLayout.configuracion === 'object') {
        layout = { ...baseLayout, ...(empresaLayout.configuracion as Record<string, any>) };
        source = 'empresa';
      }
    }

    const series = includeSeries ? await listarSeriesDocumento(empresaId, tipoDocumento) : undefined;

    return res.json({
      tipo_documento: tipoDocumento,
      serie: serie || null,
      source,
      layout,
      series,
    });
  } catch (error) {
    console.error('Error al obtener configuración de layout:', error);
    return res.status(500).json({ message: 'Error interno al obtener configuración' });
  }
}

export async function guardarLayoutConfiguracion(req: Request, res: Response) {
  try {
    const empresaId = ensureEmpresa(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa no disponible en el contexto' });

    const tipoDocumento = (req.body?.tipo_documento ?? '').toString().toLowerCase();
    if (!tipoDocumento) return res.status(400).json({ message: 'tipo_documento es obligatorio' });

    const serie = (req.body?.serie ?? '').toString().trim();
    const configuracion = req.body?.configuracion;
    if (!configuracion || typeof configuracion !== 'object') {
      return res.status(400).json({ message: 'configuracion es obligatoria' });
    }

    const nombrePlantilla = serie
      ? `Formato ${tipoDocumento} - ${serie}`
      : `Formato ${tipoDocumento} - General`;

    if (serie) {
      const serieRow = await obtenerSerieDocumento(empresaId, tipoDocumento, serie);
      if (!serieRow) return res.status(404).json({ message: 'Serie no encontrada para la empresa' });

      let layoutId = serieRow.layout_id ?? null;
      if (layoutId) {
        await actualizarLayoutConfiguracion(layoutId, configuracion);
      } else {
        const creada = await crearLayoutConfiguracion(empresaId, tipoDocumento, nombrePlantilla, configuracion);
        if (!creada?.id) return res.status(500).json({ message: 'No se pudo crear la plantilla de layout' });
        layoutId = Number(creada.id);
        await asignarLayoutASerie(serieRow.id, layoutId);
      }

      return res.json({ ok: true, scope: 'serie', layout_id: layoutId });
    }

    const layoutEmpresa = await obtenerLayoutEmpresa(empresaId, tipoDocumento);
    if (layoutEmpresa?.id) {
      await actualizarLayoutConfiguracion(Number(layoutEmpresa.id), configuracion);
      return res.json({ ok: true, scope: 'empresa', layout_id: layoutEmpresa.id });
    }

    const creada = await crearLayoutConfiguracion(empresaId, tipoDocumento, nombrePlantilla, configuracion);
    if (!creada?.id) return res.status(500).json({ message: 'No se pudo crear la plantilla de layout' });

    return res.json({ ok: true, scope: 'empresa', layout_id: creada.id });
  } catch (error) {
    console.error('Error al guardar configuración de layout:', error);
    return res.status(500).json({ message: 'Error interno al guardar configuración' });
  }
}
