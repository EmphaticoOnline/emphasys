import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import {
  listarEjerciciosDisponibles,
  listarCuentasConSaldoMes,
  obtenerSaldosAnio,
  obtenerAuxiliarCuenta,
  type AuxiliarCuentaResultado,
} from './saldos.repository';
import { generarAuxiliarCuentaPDF } from './auxiliarCuenta.pdf';

function getEmpresaId(req: Request): number {
  return Number(req.context?.empresaId ?? 0);
}

// Igual que generarExcelBuffer (backend/src/utils/exportar.ts), pero con un
// bloque de resumen (cuenta/ejercicio/periodo/cargos/abonos/movimientos)
// antes de la tabla y una fila de totales al final: el utilitario genérico
// solo arma encabezado+filas, no soporta ese resumen adicional.
function generarAuxiliarCuentaExcelBuffer(data: AuxiliarCuentaResultado): Buffer {
  const encabezado: (string | number)[][] = [
    ['Cuenta', data.cuenta.cuenta],
    ['Descripción', data.cuenta.descripcion],
    ['Ejercicio', data.ejercicio],
    ['Periodo', data.periodo],
    ['Cargos', data.resumen.cargos],
    ['Abonos', data.resumen.abonos],
    ['Número de movimientos', data.resumen.numero_movimientos],
    [],
    ['Póliza', 'Tipo', 'No.', 'Fecha', 'Concepto', 'Cargo', 'Abono', 'Referencia'],
  ];
  const filas: (string | number)[][] = data.movimientos.map((m) => [
    m.poliza_numero,
    m.tipo_poliza,
    m.renglon,
    m.fecha,
    m.concepto ?? '',
    m.cargo,
    m.abono,
    m.referencia ?? '',
  ]);
  const totales: (string | number)[] = ['', '', '', '', 'Totales', data.resumen.cargos, data.resumen.abonos, ''];

  const hoja = XLSX.utils.aoa_to_sheet([...encabezado, ...filas, totales]);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Auxiliar');
  return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function parseValidationError(error: unknown, fallback: string): { status: number; message: string } {
  const message = (error as Error)?.message ?? fallback;
  if (message.startsWith('VALIDATION_ERROR:')) {
    return { status: 400, message: message.replace('VALIDATION_ERROR:', '').trim() };
  }
  return { status: 500, message: fallback };
}

export async function getEjerciciosDisponibles(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const ejercicios = await listarEjerciciosDisponibles(empresaId);
    return res.json(ejercicios);
  } catch (error) {
    console.error('Error al obtener ejercicios disponibles', error);
    return res.status(500).json({ message: 'No se pudieron obtener los ejercicios' });
  }
}

export async function getSaldosMes(req: Request, res: Response) {
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

    const cuentas = await listarCuentasConSaldoMes(empresaId, ejercicio, periodo);
    return res.json(cuentas);
  } catch (error) {
    console.error('Error al obtener saldos por mes', error);
    return res.status(500).json({ message: 'No se pudieron obtener los saldos del mes' });
  }
}

export async function getSaldosAnio(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const ejercicio = Number(req.query.ejercicio);
    if (!Number.isInteger(ejercicio) || ejercicio <= 0) {
      return res.status(400).json({ message: 'El ejercicio es requerido y debe ser numérico' });
    }

    const resultado = await obtenerSaldosAnio(Number(req.params.id), empresaId, ejercicio);
    if (!resultado) return res.status(404).json({ message: 'Cuenta no encontrada' });
    return res.json(resultado);
  } catch (error) {
    console.error('Error al obtener saldos por año', error);
    return res.status(500).json({ message: 'No se pudieron obtener los saldos del año' });
  }
}

export async function getAuxiliarCuenta(req: Request, res: Response) {
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

    const resultado = await obtenerAuxiliarCuenta(empresaId, Number(req.params.id), ejercicio, periodo);
    if (!resultado) return res.status(404).json({ message: 'Cuenta no encontrada' });

    const formato = ((req.query.formato as string) || 'json').toLowerCase();
    const nombreArchivo = `auxiliar_${resultado.cuenta.cuenta.replace(/[^a-zA-Z0-9]+/g, '_')}_${ejercicio}_${periodo}`;

    if (formato === 'pdf') {
      const buffer = await generarAuxiliarCuentaPDF(resultado);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}.pdf"`);
      return res.send(buffer);
    }
    if (formato === 'excel') {
      const buffer = generarAuxiliarCuentaExcelBuffer(resultado);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}.xlsx"`);
      return res.send(buffer);
    }

    return res.json(resultado);
  } catch (error) {
    console.error('Error al obtener el auxiliar de la cuenta', error);
    const { status, message } = parseValidationError(error, 'No se pudo obtener el auxiliar de la cuenta');
    return res.status(status).json({ message });
  }
}
