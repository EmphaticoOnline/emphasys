import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import {
  obtenerBalanzaAnalitica,
  obtenerEstadoResultados,
  obtenerBalanceGeneral,
  type BalanzaAnaliticaResultado,
  type EstadoResultadosResultado,
  type BalanceGeneralResultado,
} from './reportesContables.repository';
import {
  generarBalanzaAnaliticaPDF,
  generarEstadoResultadosPDF,
  generarBalanceGeneralPDF,
} from './reportesContables.pdf';

function getEmpresaId(req: Request): number {
  return Number(req.context?.empresaId ?? 0);
}

function getEmpresaNombre(req: Request): string {
  return (req.context?.empresaNombre as string | undefined) ?? '';
}

function parsePeriodo(valor: unknown): number | null {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1 || n > 12) return null;
  return n;
}

function generarExcelSeccionado(hojas: { nombre: string; filas: (string | number)[][] }[]): Buffer {
  const libro = XLSX.utils.book_new();
  hojas.forEach(({ nombre, filas }) => {
    const hoja = XLSX.utils.aoa_to_sheet(filas);
    XLSX.utils.book_append_sheet(libro, hoja, nombre);
  });
  return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

// ── Balanza Analítica ─────────────────────────────────────────────────────────

function generarExcelBalanza(data: BalanzaAnaliticaResultado): Buffer {
  const filas: (string | number)[][] = [
    ['Cuenta', 'Descripción', 'Saldo inicial', 'Cargos', 'Abonos', 'Saldo final'],
    ...data.cuentas.map((c) => [c.cuenta, c.descripcion, c.saldo_inicial, c.cargos, c.abonos, c.saldo_final]),
    [],
    ['', 'Totales', '', data.totales.cargos, data.totales.abonos, ''],
  ];
  return generarExcelSeccionado([{ nombre: 'Balanza Analítica', filas }]);
}

export async function getBalanzaAnalitica(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const ejercicio = Number(req.query.ejercicio);
    const periodoInicial = parsePeriodo(req.query.periodo_inicial);
    const periodoFinal = parsePeriodo(req.query.periodo_final);
    if (!Number.isInteger(ejercicio) || ejercicio <= 0) {
      return res.status(400).json({ message: 'El ejercicio es requerido y debe ser numérico' });
    }
    if (periodoInicial === null || periodoFinal === null) {
      return res.status(400).json({ message: 'periodo_inicial y periodo_final deben estar entre 1 y 12' });
    }
    if (periodoInicial > periodoFinal) {
      return res.status(400).json({ message: 'periodo_inicial no puede ser mayor que periodo_final' });
    }

    const mostrarCeros = req.query.mostrar_ceros !== 'false';
    const soloAfectables = req.query.solo_afectables === 'true';
    const formato = ((req.query.formato as string) || 'json').toLowerCase();

    const resultado = await obtenerBalanzaAnalitica(empresaId, ejercicio, periodoInicial, periodoFinal, {
      mostrarCeros,
      soloAfectables,
    });

    if (formato === 'pdf') {
      const buffer = await generarBalanzaAnaliticaPDF(resultado, getEmpresaNombre(req));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="balanza-analitica-${ejercicio}.pdf"`);
      return res.send(buffer);
    }
    if (formato === 'excel') {
      const buffer = generarExcelBalanza(resultado);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="balanza-analitica-${ejercicio}.xlsx"`);
      return res.send(buffer);
    }
    return res.json(resultado);
  } catch (error) {
    console.error('Error al obtener la balanza analítica', error);
    return res.status(500).json({ message: 'No se pudo obtener la balanza analítica' });
  }
}

// ── Estado de Resultados ──────────────────────────────────────────────────────

// Reporte de presentación financiera: no se exporta el número de cuenta,
// solo la descripción (a diferencia de la Balanza Analítica).
function generarExcelEstadoResultados(data: EstadoResultadosResultado): Buffer {
  const filas: (string | number)[][] = [
    ['INGRESOS'],
    ['Descripción', 'Importe'],
    ...data.ingresos.map((c) => [c.descripcion, c.importe]),
    ['TOTAL INGRESOS', data.total_ingresos],
    [],
    ['EGRESOS'],
    ['Descripción', 'Importe'],
    ...data.egresos.map((c) => [c.descripcion, c.importe]),
    ['TOTAL EGRESOS', data.total_egresos],
    [],
    [data.utilidad_periodo >= 0 ? 'UTILIDAD DEL PERIODO' : 'PÉRDIDA DEL PERIODO', Math.abs(data.utilidad_periodo)],
  ];
  return generarExcelSeccionado([{ nombre: 'Estado de Resultados', filas }]);
}

export async function getEstadoResultados(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const ejercicio = Number(req.query.ejercicio);
    const periodoInicial = parsePeriodo(req.query.periodo_inicial);
    const periodoFinal = parsePeriodo(req.query.periodo_final);
    if (!Number.isInteger(ejercicio) || ejercicio <= 0) {
      return res.status(400).json({ message: 'El ejercicio es requerido y debe ser numérico' });
    }
    if (periodoInicial === null || periodoFinal === null) {
      return res.status(400).json({ message: 'periodo_inicial y periodo_final deben estar entre 1 y 12' });
    }
    if (periodoInicial > periodoFinal) {
      return res.status(400).json({ message: 'periodo_inicial no puede ser mayor que periodo_final' });
    }

    const mostrarDetalle = req.query.mostrar_detalle !== 'false';
    const formato = ((req.query.formato as string) || 'json').toLowerCase();

    const resultado = await obtenerEstadoResultados(empresaId, ejercicio, periodoInicial, periodoFinal, {
      mostrarDetalle,
    });

    if (formato === 'pdf') {
      const buffer = await generarEstadoResultadosPDF(resultado, getEmpresaNombre(req));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="estado-resultados-${ejercicio}.pdf"`);
      return res.send(buffer);
    }
    if (formato === 'excel') {
      const buffer = generarExcelEstadoResultados(resultado);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="estado-resultados-${ejercicio}.xlsx"`);
      return res.send(buffer);
    }
    return res.json(resultado);
  } catch (error) {
    console.error('Error al obtener el estado de resultados', error);
    return res.status(500).json({ message: 'No se pudo obtener el estado de resultados' });
  }
}

// ── Balance General ────────────────────────────────────────────────────────────

// Reporte de presentación financiera: no se exporta el número de cuenta.
// La sangría de las cuentas respecto a su grupo se da con espacios en la
// descripción, ya que Excel no tiene una noción visual de "nivel" en aoa_to_sheet.
function generarExcelBalanceGeneral(data: BalanceGeneralResultado): Buffer {
  const filasGrupo = (grupos: BalanceGeneralResultado['activo']): (string | number)[][] => {
    const filas: (string | number)[][] = [];
    grupos.forEach((g) => {
      filas.push([g.grupo, g.subtotal]);
      g.cuentas.forEach((c) => filas.push([`  ${c.descripcion}`, c.saldo]));
    });
    return filas;
  };

  const filas: (string | number)[][] = [
    ['ACTIVO'],
    ...filasGrupo(data.activo),
    ['TOTAL ACTIVO', data.total_activo],
    [],
    ['PASIVO'],
    ...filasGrupo(data.pasivo),
    ['TOTAL PASIVO', data.total_pasivo],
    [],
    ['CAPITAL'],
    ...filasGrupo(data.capital),
    ['TOTAL CAPITAL', data.total_capital],
    [],
    ['TOTAL PASIVO + CAPITAL', data.total_pasivo + data.total_capital],
    [data.cuadrado ? 'Balance cuadrado' : 'Diferencia', data.cuadrado ? 0 : data.diferencia],
  ];
  return generarExcelSeccionado([{ nombre: 'Balance General', filas }]);
}

export async function getBalanceGeneral(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const ejercicio = Number(req.query.ejercicio);
    const periodo = parsePeriodo(req.query.periodo);
    if (!Number.isInteger(ejercicio) || ejercicio <= 0) {
      return res.status(400).json({ message: 'El ejercicio es requerido y debe ser numérico' });
    }
    if (periodo === null) {
      return res.status(400).json({ message: 'El periodo debe estar entre 1 y 12' });
    }

    const mostrarDetalle = req.query.mostrar_detalle !== 'false';
    const formato = ((req.query.formato as string) || 'json').toLowerCase();

    const resultado = await obtenerBalanceGeneral(empresaId, ejercicio, periodo, { mostrarDetalle });

    if (formato === 'pdf') {
      const buffer = await generarBalanceGeneralPDF(resultado, getEmpresaNombre(req));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="balance-general-${ejercicio}-${periodo}.pdf"`);
      return res.send(buffer);
    }
    if (formato === 'excel') {
      const buffer = generarExcelBalanceGeneral(resultado);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="balance-general-${ejercicio}-${periodo}.xlsx"`);
      return res.send(buffer);
    }
    return res.json(resultado);
  } catch (error) {
    console.error('Error al obtener el balance general', error);
    return res.status(500).json({ message: 'No se pudo obtener el balance general' });
  }
}
