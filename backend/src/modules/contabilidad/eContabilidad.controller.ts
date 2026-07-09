import { Request, Response } from 'express';
import { validarPeriodoEContabilidad } from './eContabilidad.repository';
import { generarSugerenciasCodigosAgrupadores } from './sugerenciasCodigosAgrupadores.repository';

function getEmpresaId(req: Request): number {
  return Number(req.context?.empresaId ?? 0);
}

export async function getValidacionesEContabilidad(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const ejercicio = Number(req.query.ejercicio);
    const periodo = Number(req.query.periodo);
    if (!Number.isInteger(ejercicio) || ejercicio <= 0) {
      return res.status(400).json({ message: 'El ejercicio es requerido y debe ser numérico' });
    }
    if (!Number.isInteger(periodo) || periodo < 1 || periodo > 12) {
      return res.status(400).json({ message: 'El periodo debe estar entre 1 y 12' });
    }

    const resultado = await validarPeriodoEContabilidad(empresaId, ejercicio, periodo);
    return res.json(resultado);
  } catch (error) {
    console.error('Error al validar el periodo de contabilidad electrónica', error);
    return res.status(500).json({ message: 'No se pudo validar el periodo de contabilidad electrónica' });
  }
}

export async function getSugerenciasCodigosAgrupadores(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    // solo_afectables no es un interruptor real: las sugerencias nunca
    // aplican a cuentas no afectables (no reciben movimientos ni tiene
    // sentido asignarles código agrupador). Se acepta el parámetro por
    // compatibilidad con lo documentado, pero el filtro siempre está activo.
    const soloSinCodigo = req.query.solo_sin_codigo === 'true';

    const sugerencias = await generarSugerenciasCodigosAgrupadores(empresaId, { soloSinCodigo });
    return res.json(sugerencias);
  } catch (error) {
    console.error('Error al generar sugerencias de códigos agrupadores SAT', error);
    return res.status(500).json({ message: 'No se pudieron generar las sugerencias de códigos agrupadores SAT' });
  }
}
