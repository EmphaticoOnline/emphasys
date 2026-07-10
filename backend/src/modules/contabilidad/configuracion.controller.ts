import { Request, Response } from 'express';
import { obtenerOCrearConfiguracion, actualizarConfiguracion } from './configuracion.repository';

function getEmpresaId(req: Request): number {
  return Number(req.context?.empresaId ?? 0);
}

// undefined = el campo no vino en el body (no tocar el valor actual);
// null = el usuario lo dejó vacío a propósito (limpiar la configuración).
function parseTipoPolizaIdInput(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export async function getConfiguracion(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const configuracion = await obtenerOCrearConfiguracion(empresaId);
    return res.json(configuracion);
  } catch (error) {
    console.error('Error al obtener configuración contable', error);
    return res.status(500).json({ message: 'No se pudo obtener la configuración contable' });
  }
}

export async function putConfiguracion(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const configuracion = await actualizarConfiguracion(empresaId, {
      estructura_cuentas: req.body?.estructura_cuentas,
      caracter_separador: req.body?.caracter_separador,
      permitir_venta_no_timbrada:
        typeof req.body?.permitir_venta_no_timbrada === 'boolean' ? req.body.permitir_venta_no_timbrada : undefined,
      tipo_poliza_venta_factura_id: parseTipoPolizaIdInput(req.body?.tipo_poliza_venta_factura_id),
      tipo_poliza_venta_cancelacion_id: parseTipoPolizaIdInput(req.body?.tipo_poliza_venta_cancelacion_id),
    });
    return res.json(configuracion);
  } catch (error) {
    console.error('Error al actualizar configuración contable', error);
    const message = (error as Error)?.message ?? 'No se pudo actualizar la configuración contable';
    if (message.startsWith('VALIDATION_ERROR:')) {
      return res.status(400).json({ message: message.replace('VALIDATION_ERROR:', '').trim() });
    }
    return res.status(500).json({ message: 'No se pudo actualizar la configuración contable' });
  }
}
