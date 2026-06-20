import { Request, Response } from 'express';
import { generarExcelBuffer, type ExportColumna } from '../../utils/exportar';
import {
  obtenerEstadoCuentaProveedor,
  obtenerEstadoCuentaCliente,
  obtenerComprasPorProveedor,
  type MovimientoEstadoCuenta,
  type EstadoCuentaResult,
  type ComprasPorProveedorResult,
} from './reportes.repository';
import { generarEstadoCuentaPDF, generarComprasPorProveedorPDF } from './reportes.pdf';

const fmtFechaMX = (iso: string): string => {
  if (!iso || iso.length < 10) return iso;
  const [yr, mo, da] = iso.slice(0, 10).split('-');
  return `${da}-${mo}-${yr}`;
};

const COLUMNAS_ESTANDAR: ExportColumna[] = [
  { field: 'fecha',         headerName: 'Fecha'        },
  { field: 'folio',         headerName: 'Folio'        },
  { field: 'tipo_etiqueta', headerName: 'Tipo'         },
  { field: 'concepto',      headerName: 'Concepto'     },
  { field: 'cargo',         headerName: 'Cargo'        },
  { field: 'abono',         headerName: 'Abono'        },
  { field: 'saldo_actual',  headerName: 'Saldo'        },
];

const COLUMNAS_DETALLE: ExportColumna[] = [
  { field: 'fecha',          headerName: 'Fecha'           },
  { field: 'folio',          headerName: 'Folio'           },
  { field: 'tipo_etiqueta',  headerName: 'Tipo'            },
  { field: 'concepto',       headerName: 'Concepto'        },
  { field: 'total_doc',      headerName: 'Total documento' },
  { field: 'aplicado',       headerName: 'Aplicado'        },
  { field: 'saldo',          headerName: 'Saldo'           },
];

function flattenDetalle(movimientos: MovimientoEstadoCuenta[]): Record<string, unknown>[] {
  const filas: Record<string, unknown>[] = [];
  for (const m of movimientos) {
    const totalDoc   = m.total_original ?? 0;
    const saldoAct   = m.cancelado ? 0 : (m.saldo_actual ?? 0);
    const aplicado   = m.cancelado ? 0 : Math.max(0, totalDoc - saldoAct);
    filas.push({
      fecha:         fmtFechaMX(m.fecha),
      folio:         m.folio,
      tipo_etiqueta: m.tipo_etiqueta,
      concepto:      m.concepto,
      total_doc:     totalDoc,
      aplicado,
      saldo:         saldoAct,
    });
    for (const a of m.aplicaciones ?? []) {
      filas.push({
        fecha:         fmtFechaMX(a.fecha),
        folio:         `  › ${a.folio}`,
        tipo_etiqueta: a.tipo_etiqueta,
        concepto:      a.concepto,
        total_doc:     '',
        aplicado:      a.monto,
        saldo:         '',
      });
    }
  }
  return filas;
}

function buildCsv(
  movimientos: MovimientoEstadoCuenta[],
  columnas: ExportColumna[],
  detalle: boolean
): string {
  const encabezado = columnas.map((c) => c.headerName).join(',');
  const registros: Record<string, unknown>[] = detalle
    ? flattenDetalle(movimientos)
    : movimientos.map((m) => ({ ...(m as unknown as Record<string, unknown>), fecha: fmtFechaMX(m.fecha) }));
  const filas = registros.map((m) =>
    columnas.map((c) => {
      const val = m[c.field];
      if (val === null || val === undefined || val === '') return '';
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',')
  );
  return [encabezado, ...filas].join('\r\n');
}

async function sendEstadoCuenta(
  res: Response,
  resultado: EstadoCuentaResult,
  formato: string,
  fileLabel: string,
  titulo: string,
  contactoLabel: string,
  detalle: boolean
) {
  const columnas = detalle ? COLUMNAS_DETALLE : COLUMNAS_ESTANDAR;

  if (formato === 'excel') {
    const registros = detalle
      ? flattenDetalle(resultado.movimientos)
      : resultado.movimientos.map((m) => ({ ...(m as unknown as Record<string, unknown>), fecha: fmtFechaMX(m.fecha) }));
    const buffer = generarExcelBuffer(registros, columnas, 'Estado de Cuenta');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="estado-cuenta-${fileLabel}.xlsx"`);
    return res.send(buffer);
  }

  if (formato === 'csv') {
    const csv = buildCsv(resultado.movimientos, columnas, detalle);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="estado-cuenta-${fileLabel}.csv"`);
    return res.send('﻿' + csv);
  }

  if (formato === 'pdf') {
    const buffer = await generarEstadoCuentaPDF(resultado, titulo, contactoLabel, detalle);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="estado-cuenta-${fileLabel}.pdf"`);
    return res.send(buffer);
  }

  return res.json(resultado);
}

function parseParams(req: Request) {
  const empresaId = req.context?.empresaId as number | undefined;
  const contactoId = Number(req.query.contacto_id);
  const fechaCorte = (req.query.fecha_corte as string) || null;
  const incluirCancelados = req.query.incluir_cancelados === 'true';
  const detalle = req.query.detalle === 'true';
  const formato = ((req.query.formato as string) || 'json').toLowerCase();
  return { empresaId, contactoId, fechaCorte, incluirCancelados, detalle, formato };
}

export async function getEstadoCuentaProveedor(req: Request, res: Response) {
  const { empresaId, contactoId, fechaCorte, incluirCancelados, detalle, formato } = parseParams(req);
  if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
  if (!Number.isFinite(contactoId) || contactoId <= 0)
    return res.status(400).json({ message: 'contacto_id requerido' });
  try {
    const resultado = await obtenerEstadoCuentaProveedor({
      contactoId, empresaId, fechaCorte, incluirCancelados, detalle,
    });
    return sendEstadoCuenta(res, resultado, formato, 'proveedor', 'Estado de Cuenta de Proveedor', 'Proveedor', detalle);
  } catch (err: unknown) {
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Error' });
  }
}

export async function getEstadoCuentaCliente(req: Request, res: Response) {
  const { empresaId, contactoId, fechaCorte, incluirCancelados, detalle, formato } = parseParams(req);
  if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
  if (!Number.isFinite(contactoId) || contactoId <= 0)
    return res.status(400).json({ message: 'contacto_id requerido' });
  try {
    const resultado = await obtenerEstadoCuentaCliente({
      contactoId, empresaId, fechaCorte, incluirCancelados, detalle,
    });
    return sendEstadoCuenta(res, resultado, formato, 'cliente', 'Estado de Cuenta de Cliente', 'Cliente', detalle);
  } catch (err: unknown) {
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Error' });
  }
}

// ── Compras por Proveedor ─────────────────────────────────────────────────────

const COLS_COMPRAS_RESUMEN: ExportColumna[] = [
  { field: 'nombre',             headerName: 'Proveedor'       },
  { field: 'rfc',                headerName: 'RFC'             },
  { field: 'cantidad_facturas',  headerName: 'Facturas'        },
  { field: 'subtotal',           headerName: 'Subtotal'        },
  { field: 'iva',                headerName: 'IVA'             },
  { field: 'total_comprado',     headerName: 'Total Comprado'  },
  { field: 'pct_participacion',  headerName: '% Participación' },
];

const COLS_COMPRAS_DETALLE: ExportColumna[] = [
  { field: 'proveedor',          headerName: 'Proveedor'       },
  { field: 'rfc',                headerName: 'RFC'             },
  { field: 'fecha',              headerName: 'Fecha'           },
  { field: 'folio',              headerName: 'Folio'           },
  { field: 'subtotal',           headerName: 'Subtotal'        },
  { field: 'iva',                headerName: 'IVA'             },
  { field: 'total',              headerName: 'Total'           },
];

function buildFilasExcelDetalle(resultado: ComprasPorProveedorResult): Record<string, unknown>[] {
  const filas: Record<string, unknown>[] = [];
  const mapProveedor = new Map(resultado.proveedores.map((p) => [p.proveedor_id, p]));
  const facturasPorProveedor = new Map<number, typeof resultado.facturas>();
  for (const f of resultado.facturas) {
    if (!facturasPorProveedor.has(f.proveedor_id)) facturasPorProveedor.set(f.proveedor_id, []);
    facturasPorProveedor.get(f.proveedor_id)!.push(f);
  }
  for (const p of resultado.proveedores) {
    const facturas = facturasPorProveedor.get(p.proveedor_id) ?? [];
    for (const f of facturas) {
      filas.push({
        proveedor:  mapProveedor.get(f.proveedor_id)?.nombre ?? '',
        rfc:        mapProveedor.get(f.proveedor_id)?.rfc ?? '',
        fecha:      fmtFechaMX(f.fecha),
        folio:      f.folio,
        subtotal:   f.subtotal,
        iva:        f.iva,
        total:      f.total,
      });
    }
  }
  return filas;
}

export async function getComprasPorProveedor(req: Request, res: Response) {
  const empresaId = req.context?.empresaId as number | undefined;
  if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

  const fechaInicio = (req.query.fecha_inicio as string) || '';
  const fechaFin    = (req.query.fecha_fin as string)    || '';
  if (!fechaInicio || !fechaFin) return res.status(400).json({ message: 'fecha_inicio y fecha_fin son requeridos' });

  const proveedorId     = req.query.proveedor_id ? Number(req.query.proveedor_id) : null;
  const incluirCancelados = req.query.incluir_cancelados === 'true';
  const detalle           = req.query.detalle === 'true';
  const formato           = ((req.query.formato as string) || 'json').toLowerCase();

  try {
    const resultado = await obtenerComprasPorProveedor({
      empresaId, fechaInicio, fechaFin, proveedorId, incluirCancelados, detalle,
    });

    if (formato === 'json') return res.json(resultado);

    const titulo = 'Compras por Proveedor';

    if (formato === 'pdf') {
      const buffer = await generarComprasPorProveedorPDF(resultado, detalle);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="compras-por-proveedor.pdf"`);
      return res.send(buffer);
    }

    if (formato === 'excel') {
      const filas = detalle
        ? buildFilasExcelDetalle(resultado)
        : resultado.proveedores.map((p) => ({ ...p }));
      const columnas = detalle ? COLS_COMPRAS_DETALLE : COLS_COMPRAS_RESUMEN;
      const buffer = generarExcelBuffer(filas, columnas, titulo);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="compras-por-proveedor.xlsx"`);
      return res.send(buffer);
    }

    return res.status(400).json({ message: 'Formato no soportado' });
  } catch (err: unknown) {
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Error' });
  }
}
