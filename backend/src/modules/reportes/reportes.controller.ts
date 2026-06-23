import { Request, Response } from 'express';
import { generarExcelBuffer, type ExportColumna } from '../../utils/exportar';
import {
  obtenerEstadoCuentaProveedor,
  obtenerEstadoCuentaCliente,
  obtenerComprasPorProveedor,
  obtenerVentasPorCliente,
  obtenerComprasPorProducto,
  obtenerVentasPorProducto,
  obtenerOCPendientesRecibir,
  obtenerVencimientosProveedores,
  obtenerHistorialPreciosCompra,
  obtenerHistorialPreciosVenta,
  obtenerComprasPorPeriodo,
  obtenerVentasPorPeriodo,
  obtenerPedidosPendientesFacturar,
  obtenerRemisionesPendientesFacturar,
  type MovimientoEstadoCuenta,
  type EstadoCuentaResult,
  type VolumenContactoResult,
  type VolumenProductoResult,
  type OCPendientesResult,
  type OCPendientePartida,
  type MovimientosPorPeriodoResult,
  type PendientesFacturarResult,
  type Agrupacion,
} from './reportes.repository';
import { generarEstadoCuentaPDF, generarVolumenContactoPDF, generarVolumenProductoPDF, generarOCPendientesPDF, generarVencimientosProveedoresPDF, generarHistorialPreciosPDF, generarMovimientosPorPeriodoPDF, generarPendientesFacturarPDF } from './reportes.pdf';

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

// ── Volumen por Contacto (genérico) ──────────────────────────────────────────

function buildColsResumen(contactoLabel: string): ExportColumna[] {
  return [
    { field: 'nombre',            headerName: contactoLabel     },
    { field: 'rfc',               headerName: 'RFC'             },
    { field: 'cantidad_facturas', headerName: 'Facturas'        },
    { field: 'subtotal',          headerName: 'Subtotal'        },
    { field: 'iva',               headerName: 'IVA'             },
    { field: 'total_comprado',    headerName: 'Total Comprado'  },
    { field: 'pct_participacion', headerName: '% Participación' },
  ];
}

function buildColsDetalle(contactoLabel: string): ExportColumna[] {
  return [
    { field: 'contacto', headerName: contactoLabel },
    { field: 'rfc',      headerName: 'RFC'         },
    { field: 'fecha',    headerName: 'Fecha'       },
    { field: 'folio',    headerName: 'Folio'       },
    { field: 'subtotal', headerName: 'Subtotal'    },
    { field: 'iva',      headerName: 'IVA'         },
    { field: 'total',    headerName: 'Total'       },
  ];
}

function buildFilasExcelDetalle(resultado: VolumenContactoResult): Record<string, unknown>[] {
  const filas: Record<string, unknown>[] = [];
  const mapContacto = new Map(resultado.contactos.map((c) => [c.contacto_id, c]));
  for (const c of resultado.contactos) {
    for (const f of resultado.facturas.filter((f) => f.contacto_id === c.contacto_id)) {
      filas.push({
        contacto: mapContacto.get(f.contacto_id)?.nombre ?? '',
        rfc:      mapContacto.get(f.contacto_id)?.rfc ?? '',
        fecha:    fmtFechaMX(f.fecha),
        folio:    f.folio,
        subtotal: f.subtotal,
        iva:      f.iva,
        total:    f.total,
      });
    }
  }
  return filas;
}

async function sendVolumenContacto(
  res: Response,
  resultado: VolumenContactoResult,
  formato: string,
  titulo: string,
  contactoLabel: string,
  fileSlug: string,
  detalle: boolean
) {
  if (formato === 'json') return res.json(resultado);

  if (formato === 'pdf') {
    const buffer = await generarVolumenContactoPDF(resultado, detalle, titulo, contactoLabel);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileSlug}.pdf"`);
    return res.send(buffer);
  }

  if (formato === 'excel') {
    const filas = detalle
      ? buildFilasExcelDetalle(resultado)
      : resultado.contactos.map((c) => ({ ...c }));
    const columnas = detalle ? buildColsDetalle(contactoLabel) : buildColsResumen(contactoLabel);
    const buffer = generarExcelBuffer(filas, columnas, titulo);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileSlug}.xlsx"`);
    return res.send(buffer);
  }

  return res.status(400).json({ message: 'Formato no soportado' });
}

function parseVolumenParams(req: Request) {
  const empresaId  = req.context?.empresaId as number | undefined;
  const fechaInicio = (req.query.fecha_inicio as string) || '';
  const fechaFin    = (req.query.fecha_fin as string)    || '';
  const contactoId  = req.query.contacto_id ? Number(req.query.contacto_id) : null;
  const detalle     = req.query.detalle === 'true';
  const formato     = ((req.query.formato as string) || 'json').toLowerCase();
  return { empresaId, fechaInicio, fechaFin, contactoId, detalle, formato };
}

export async function getComprasPorProveedor(req: Request, res: Response) {
  const { empresaId, fechaInicio, fechaFin, contactoId, detalle, formato } = parseVolumenParams(req);
  if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
  if (!fechaInicio || !fechaFin) return res.status(400).json({ message: 'fecha_inicio y fecha_fin son requeridos' });
  try {
    const resultado = await obtenerComprasPorProveedor({ empresaId, fechaInicio, fechaFin, contactoId, detalle });
    return sendVolumenContacto(res, resultado, formato, 'Compras por Proveedor', 'Proveedor', 'compras-por-proveedor', detalle);
  } catch (err: unknown) {
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Error' });
  }
}

export async function getVentasPorCliente(req: Request, res: Response) {
  const { empresaId, fechaInicio, fechaFin, contactoId, detalle, formato } = parseVolumenParams(req);
  if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
  if (!fechaInicio || !fechaFin) return res.status(400).json({ message: 'fecha_inicio y fecha_fin son requeridos' });
  try {
    const resultado = await obtenerVentasPorCliente({ empresaId, fechaInicio, fechaFin, contactoId, detalle });
    return sendVolumenContacto(res, resultado, formato, 'Ventas por Cliente', 'Cliente', 'ventas-por-cliente', detalle);
  } catch (err: unknown) {
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Error' });
  }
}

// ── Volumen por Producto (Compras / Ventas) ───────────────────────────────────

function buildColsProductoResumen(ultimoPrecioLabel: string): ExportColumna[] {
  return [
    { field: 'clave',                  headerName: 'Clave'             },
    { field: 'descripcion',            headerName: 'Descripción'       },
    { field: 'unidad',                 headerName: 'Unidad'            },
    { field: 'cantidad_total',         headerName: 'Cantidad'          },
    { field: 'cantidad_documentos',    headerName: 'Documentos'        },
    { field: 'precio_promedio',        headerName: 'Precio Prom.'      },
    { field: 'ultimo_precio_unitario', headerName: ultimoPrecioLabel   },
    { field: 'subtotal',               headerName: 'Subtotal'          },
    { field: 'iva',                    headerName: 'IVA'               },
    { field: 'total',                  headerName: 'Total'             },
    { field: 'ultimo_movimiento',      headerName: 'Últ. Movimiento'  },
    { field: 'pct_participacion',      headerName: '% Participación'  },
  ];
}

function buildColsProductoDetalle(contactoLabel: string): ExportColumna[] {
  return [
    { field: 'clave',           headerName: 'Clave'         },
    { field: 'descripcion',     headerName: 'Descripción'   },
    { field: 'fecha',           headerName: 'Fecha'         },
    { field: 'folio',           headerName: 'Folio'         },
    { field: 'contacto_nombre', headerName: contactoLabel   },
    { field: 'cantidad',        headerName: 'Cantidad'      },
    { field: 'precio_unitario', headerName: 'Precio Unit.'  },
    { field: 'descuento',       headerName: 'Descuento'     },
    { field: 'subtotal',        headerName: 'Subtotal'      },
    { field: 'total',           headerName: 'Total'         },
  ];
}

function buildFilasExcelProductoDetalle(resultado: VolumenProductoResult): Record<string, unknown>[] {
  const mapProducto = new Map(resultado.productos.map((p) => [p.grupo_key, p]));
  return resultado.partidas.map((partida) => {
    const prod = mapProducto.get(partida.grupo_key);
    return {
      clave:           prod?.clave ?? '',
      descripcion:     prod?.descripcion ?? '',
      fecha:           fmtFechaMX(partida.fecha),
      folio:           partida.folio,
      contacto_nombre: partida.contacto_nombre,
      cantidad:        partida.cantidad,
      precio_unitario: partida.precio_unitario,
      descuento:       partida.descuento,
      subtotal:        partida.subtotal,
      total:           partida.total,
    };
  });
}

async function sendVolumenProducto(
  res: Response,
  resultado: VolumenProductoResult,
  formato: string,
  titulo: string,
  contactoLabel: string,
  ultimoPrecioLabel: string,
  fileSlug: string,
  detalle: boolean
) {
  if (formato === 'json') return res.json(resultado);

  if (formato === 'pdf') {
    const buffer = await generarVolumenProductoPDF(resultado, detalle, titulo, contactoLabel, ultimoPrecioLabel);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileSlug}.pdf"`);
    return res.send(buffer);
  }

  if (formato === 'excel') {
    const filas = detalle
      ? buildFilasExcelProductoDetalle(resultado)
      : resultado.productos.map((p) => ({ ...p, ultimo_movimiento: fmtFechaMX(p.ultimo_movimiento) }));
    const columnas = detalle
      ? buildColsProductoDetalle(contactoLabel)
      : buildColsProductoResumen(ultimoPrecioLabel);
    const buffer = generarExcelBuffer(filas, columnas, titulo);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileSlug}.xlsx"`);
    return res.send(buffer);
  }

  return res.status(400).json({ message: 'Formato no soportado' });
}

function parseProductoParams(req: Request) {
  const empresaId           = req.context?.empresaId as number | undefined;
  const fechaInicio         = (req.query.fecha_inicio as string) || '';
  const fechaFin            = (req.query.fecha_fin as string)    || '';
  const productoId          = req.query.producto_id ? Number(req.query.producto_id) : null;
  const contactoId          = req.query.contacto_id ? Number(req.query.contacto_id) : null;
  const detalle             = req.query.detalle === 'true';
  const excluirSinMovimiento = req.query.excluir_sin_movimiento !== 'false';
  const formato             = ((req.query.formato as string) || 'json').toLowerCase();
  return { empresaId, fechaInicio, fechaFin, productoId, contactoId, detalle, excluirSinMovimiento, formato };
}

export async function getComprasPorProducto(req: Request, res: Response) {
  const { empresaId, fechaInicio, fechaFin, productoId, contactoId, detalle, excluirSinMovimiento, formato } = parseProductoParams(req);
  if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
  if (!fechaInicio || !fechaFin) return res.status(400).json({ message: 'fecha_inicio y fecha_fin son requeridos' });
  try {
    const resultado = await obtenerComprasPorProducto({ empresaId, fechaInicio, fechaFin, productoId, contactoId, detalle, excluirSinMovimiento });
    return sendVolumenProducto(res, resultado, formato, 'Compras por Producto', 'Proveedor', 'Último costo', 'compras-por-producto', detalle);
  } catch (err: unknown) {
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Error' });
  }
}

export async function getVentasPorProducto(req: Request, res: Response) {
  const { empresaId, fechaInicio, fechaFin, productoId, contactoId, detalle, excluirSinMovimiento, formato } = parseProductoParams(req);
  if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
  if (!fechaInicio || !fechaFin) return res.status(400).json({ message: 'fecha_inicio y fecha_fin son requeridos' });
  try {
    const resultado = await obtenerVentasPorProducto({ empresaId, fechaInicio, fechaFin, productoId, contactoId, detalle, excluirSinMovimiento });
    return sendVolumenProducto(res, resultado, formato, 'Ventas por Producto', 'Cliente', 'Último precio', 'ventas-por-producto', detalle);
  } catch (err: unknown) {
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Error' });
  }
}

// ── OC Pendientes de Recibir ──────────────────────────────────────────────────

function buildColsOCResumen(): ExportColumna[] {
  return [
    { field: 'fecha_oc',              headerName: 'Fecha OC'         },
    { field: 'folio',                 headerName: 'Folio'            },
    { field: 'proveedor_nombre',      headerName: 'Proveedor'        },
    { field: 'total_oc',              headerName: 'Importe OC'       },
    { field: 'cantidad_ordenada',     headerName: 'Cant. Ordenada'   },
    { field: 'cantidad_materializada',headerName: 'Cant. Recibida'   },
    { field: 'cantidad_pendiente',    headerName: 'Cant. Pendiente'  },
    { field: 'pct_recibido',          headerName: '% Recibido'       },
    { field: 'dias_transcurridos',    headerName: 'Días'             },
  ];
}

function buildColsOCDetalle(): ExportColumna[] {
  return [
    { field: 'folio',                 headerName: 'Folio OC'         },
    { field: 'proveedor_nombre',      headerName: 'Proveedor'        },
    { field: 'fecha_oc',              headerName: 'Fecha OC'         },
    { field: 'clave',                 headerName: 'Clave'            },
    { field: 'descripcion',           headerName: 'Descripción'      },
    { field: 'unidad',                headerName: 'Unidad'           },
    { field: 'cantidad_ordenada',     headerName: 'Cant. Ordenada'   },
    { field: 'cantidad_materializada',headerName: 'Cant. Recibida'   },
    { field: 'cantidad_pendiente',    headerName: 'Cant. Pendiente'  },
    { field: 'pct_recibido',          headerName: '% Recibido'       },
  ];
}

function buildFilasExcelOCDetalle(resultado: OCPendientesResult): Record<string, unknown>[] {
  const mapOC = new Map(resultado.ordenes.map((o) => [o.oc_id, o]));
  return resultado.partidas.map((p: OCPendientePartida) => {
    const oc = mapOC.get(p.oc_id);
    return {
      folio:                  oc?.folio ?? '',
      proveedor_nombre:       oc?.proveedor_nombre ?? '',
      fecha_oc:               fmtFechaMX(oc?.fecha_oc ?? ''),
      clave:                  p.clave,
      descripcion:            p.descripcion,
      unidad:                 p.unidad,
      cantidad_ordenada:      p.cantidad_ordenada,
      cantidad_materializada: p.cantidad_materializada,
      cantidad_pendiente:     p.cantidad_pendiente,
      pct_recibido:           p.pct_recibido,
    };
  });
}

async function sendOCPendientes(
  res: Response,
  resultado: OCPendientesResult,
  formato: string,
  detalle: boolean
) {
  if (formato === 'json') return res.json(resultado);

  if (formato === 'pdf') {
    const buffer = await generarOCPendientesPDF(resultado, detalle);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="oc-pendientes-recibir.pdf"');
    return res.send(buffer);
  }

  if (formato === 'excel') {
    const filas = detalle
      ? buildFilasExcelOCDetalle(resultado)
      : resultado.ordenes.map((o) => ({ ...o, fecha_oc: fmtFechaMX(o.fecha_oc) }));
    const columnas = detalle ? buildColsOCDetalle() : buildColsOCResumen();
    const buffer = generarExcelBuffer(filas, columnas, 'OC Pendientes de Recibir');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="oc-pendientes-recibir.xlsx"');
    return res.send(buffer);
  }

  return res.status(400).json({ message: 'Formato no soportado' });
}

function parseOCPendientesParams(req: Request) {
  const empresaId                   = req.context?.empresaId as number | undefined;
  const hoy                         = new Date().toISOString().slice(0, 10);
  const fechaCorte                  = (req.query.fecha_corte as string) || hoy;
  const contactoId                  = req.query.contacto_id ? Number(req.query.contacto_id) : null;
  const excluirCompletamenteRecibidas = req.query.excluir_completamente_recibidas !== 'false';
  const detalle                     = req.query.detalle === 'true';
  const formato                     = ((req.query.formato as string) || 'json').toLowerCase();
  return { empresaId, fechaCorte, contactoId, excluirCompletamenteRecibidas, detalle, formato };
}

export async function getOCPendientesRecibir(req: Request, res: Response) {
  const { empresaId, fechaCorte, contactoId, excluirCompletamenteRecibidas, detalle, formato } = parseOCPendientesParams(req);
  if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
  try {
    const resultado = await obtenerOCPendientesRecibir({ empresaId, fechaCorte, contactoId, excluirCompletamenteRecibidas, detalle });
    return sendOCPendientes(res, resultado, formato, detalle);
  } catch (err: unknown) {
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Error' });
  }
}

// ── Historial de Precios de Compra ────────────────────────────────────────────

const COLUMNAS_HISTORIAL_PRECIOS: ExportColumna[] = [
  { field: 'fecha',                headerName: 'Fecha'           },
  { field: 'proveedor_nombre',     headerName: 'Proveedor'       },
  { field: 'folio',                headerName: 'Documento'       },
  { field: 'referencia_proveedor', headerName: 'Ref. Proveedor'  },
  { field: 'clave',                headerName: 'Clave'           },
  { field: 'descripcion',          headerName: 'Descripción'     },
  { field: 'cantidad',             headerName: 'Cantidad'        },
  { field: 'precio_unitario',      headerName: 'Precio Unitario' },
  { field: 'subtotal',             headerName: 'Subtotal'        },
];

function parseHistorialPreciosParams(req: Request) {
  const empresaId   = req.context?.empresaId as number | undefined;
  const hoy         = new Date().toISOString().slice(0, 10);
  const primerDia   = `${hoy.slice(0, 7)}-01`;
  const fechaInicio = (req.query.fecha_inicio as string) || primerDia;
  const fechaFin    = (req.query.fecha_fin    as string) || hoy;
  const productoId  = req.query.producto_id  ? Number(req.query.producto_id)  : null;
  const contactoId  = req.query.contacto_id  ? Number(req.query.contacto_id)  : null;
  const formato     = ((req.query.formato as string) || 'json').toLowerCase();
  return { empresaId, fechaInicio, fechaFin, productoId, contactoId, formato };
}

export async function getHistorialPreciosCompra(req: Request, res: Response) {
  const { empresaId, fechaInicio, fechaFin, productoId, contactoId, formato } = parseHistorialPreciosParams(req);
  if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
  if (!fechaInicio || !fechaFin) return res.status(400).json({ message: 'fecha_inicio y fecha_fin son requeridos' });
  try {
    const resultado = await obtenerHistorialPreciosCompra({ empresaId, fechaInicio, fechaFin, productoId, contactoId });

    if (formato === 'excel') {
      const filas = resultado.lineas.map((l) => ({
        ...l,
        fecha: fmtFechaMX(l.fecha),
      }));
      const buffer = generarExcelBuffer(filas, COLUMNAS_HISTORIAL_PRECIOS, 'Historial de Precios de Compra');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="historial-precios-compra.xlsx"');
      return res.send(buffer);
    }

    if (formato === 'pdf') {
      const buffer = await generarHistorialPreciosPDF(resultado);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="historial-precios-compra.pdf"');
      return res.send(buffer);
    }

    return res.json(resultado);
  } catch (err: unknown) {
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Error' });
  }
}

// ── Vencimientos de Proveedores ───────────────────────────────────────────────

const COLUMNAS_VENCIMIENTOS: ExportColumna[] = [
  { field: 'fecha_vencimiento',    headerName: 'Vencimiento'    },
  { field: 'dias',                 headerName: 'Días'           },
  { field: 'proveedor_nombre',     headerName: 'Proveedor'      },
  { field: 'folio',                headerName: 'Documento'      },
  { field: 'referencia_proveedor', headerName: 'Ref. Proveedor' },
  { field: 'total',                headerName: 'Total'          },
  { field: 'saldo',                headerName: 'Saldo'          },
];

function parseVencimientosParams(req: Request) {
  const empresaId  = req.context?.empresaId as number | undefined;
  const hoy        = new Date().toISOString().slice(0, 10);
  const fechaCorte = (req.query.fecha_corte as string) || hoy;
  const contactoId = req.query.contacto_id ? Number(req.query.contacto_id) : null;
  const moneda     = (req.query.moneda as string) || null;
  const formato    = ((req.query.formato as string) || 'json').toLowerCase();
  return { empresaId, fechaCorte, contactoId, moneda, formato };
}

// ── Movimientos por Período (Compras / Ventas) ────────────────────────────────

const AGRUPACIONES_VALIDAS: Agrupacion[] = ['dia', 'semana', 'mes', 'anio'];

function parsePeriodoParams(req: Request) {
  const empresaId   = req.context?.empresaId as number | undefined;
  const hoy         = new Date().toISOString().slice(0, 10);
  const primerDia   = `${hoy.slice(0, 7)}-01`;
  const fechaInicio = (req.query.fecha_inicio as string) || primerDia;
  const fechaFin    = (req.query.fecha_fin    as string) || hoy;
  const agrupacion  = ((req.query.agrupacion  as string) || 'mes').toLowerCase() as Agrupacion;
  const contactoId  = req.query.contacto_id ? Number(req.query.contacto_id) : null;
  const productoId  = req.query.producto_id  ? Number(req.query.producto_id)  : null;
  const formato     = ((req.query.formato     as string) || 'json').toLowerCase();
  return { empresaId, fechaInicio, fechaFin, agrupacion, contactoId, productoId, formato };
}

function buildColsPeriodoResumen(contactoLabel: string, mostrarCantidad: boolean): ExportColumna[] {
  const cols: ExportColumna[] = [
    { field: 'periodo_label',       headerName: 'Período'              },
    { field: 'cantidad_documentos', headerName: 'Documentos'           },
    { field: 'cantidad_contactos',  headerName: contactoLabel + 's'    },
  ];
  if (mostrarCantidad) cols.push({ field: 'cantidad_total', headerName: 'Cantidad' });
  cols.push(
    { field: 'subtotal', headerName: 'Subtotal' },
    { field: 'iva',      headerName: 'IVA'      },
    { field: 'total',    headerName: 'Total'    },
  );
  return cols;
}

function buildColsPeriodoDetalle(contactoLabel: string, mostrarCantidad: boolean): ExportColumna[] {
  const cols: ExportColumna[] = [
    { field: 'periodo_label',   headerName: 'Período'     },
    { field: 'fecha',           headerName: 'Fecha'       },
    { field: 'folio',           headerName: 'Documento'   },
    { field: 'contacto_nombre', headerName: contactoLabel },
  ];
  if (mostrarCantidad) cols.push({ field: 'cantidad_total', headerName: 'Cantidad' });
  cols.push(
    { field: 'subtotal', headerName: 'Subtotal' },
    { field: 'iva',      headerName: 'IVA'      },
    { field: 'total',    headerName: 'Total'    },
  );
  return cols;
}

function buildFilasExcelPeriodoDetalle(resultado: MovimientosPorPeriodoResult): Record<string, unknown>[] {
  const labelPorKey = new Map(resultado.periodos.map((p) => [p.periodo_key, p.periodo_label]));
  return resultado.documentos.map((d) => ({
    periodo_label:   labelPorKey.get(d.periodo_key) ?? d.periodo_key,
    fecha:           fmtFechaMX(d.fecha),
    folio:           d.folio,
    contacto_nombre: d.contacto_nombre,
    cantidad_total:  d.cantidad_total,
    subtotal:        d.subtotal,
    iva:             d.iva,
    total:           d.total,
  }));
}

async function sendMovimientosPorPeriodo(
  res: Response,
  resultado: MovimientosPorPeriodoResult,
  formato: string,
  titulo: string,
  contactoLabel: string,
  fileSlug: string,
  mostrarCantidad: boolean,
) {
  if (formato === 'json') return res.json(resultado);

  if (formato === 'pdf') {
    const buffer = await generarMovimientosPorPeriodoPDF(resultado, titulo, contactoLabel, mostrarCantidad);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileSlug}.pdf"`);
    return res.send(buffer);
  }

  if (formato === 'excel') {
    const filasResumen = resultado.periodos.map((p) => ({ ...p }));
    const filasDetalle = buildFilasExcelPeriodoDetalle(resultado);
    const conDetalle = resultado.documentos.length > 0;
    const filas = conDetalle ? [
      ...filasResumen.map((p) => ({
        periodo_label:   p.periodo_label,
        fecha:           '',
        folio:           '',
        contacto_nombre: `${p.cantidad_documentos} doc.`,
        cantidad_total:  p.cantidad_total,
        subtotal:        p.subtotal,
        iva:             p.iva,
        total:           p.total,
      })),
      ...filasDetalle,
    ] : filasResumen;
    const cols = conDetalle
      ? buildColsPeriodoDetalle(contactoLabel, mostrarCantidad)
      : buildColsPeriodoResumen(contactoLabel, mostrarCantidad);
    const buffer = generarExcelBuffer(filas, cols, titulo);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileSlug}.xlsx"`);
    return res.send(buffer);
  }

  return res.status(400).json({ message: 'Formato no soportado' });
}

export async function getComprasPorPeriodo(req: Request, res: Response) {
  const { empresaId, fechaInicio, fechaFin, agrupacion, contactoId, productoId, formato } = parsePeriodoParams(req);
  if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
  if (!fechaInicio || !fechaFin) return res.status(400).json({ message: 'fecha_inicio y fecha_fin son requeridos' });
  if (!AGRUPACIONES_VALIDAS.includes(agrupacion)) return res.status(400).json({ message: 'agrupacion inválida' });
  try {
    const resultado = await obtenerComprasPorPeriodo({ empresaId, fechaInicio, fechaFin, agrupacion, contactoId, productoId });
    return sendMovimientosPorPeriodo(res, resultado, formato, 'Compras por Período', 'Proveedor', 'compras-por-periodo', !!productoId);
  } catch (err: unknown) {
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Error' });
  }
}

export async function getVentasPorPeriodo(req: Request, res: Response) {
  const { empresaId, fechaInicio, fechaFin, agrupacion, contactoId, productoId, formato } = parsePeriodoParams(req);
  if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
  if (!fechaInicio || !fechaFin) return res.status(400).json({ message: 'fecha_inicio y fecha_fin son requeridos' });
  if (!AGRUPACIONES_VALIDAS.includes(agrupacion)) return res.status(400).json({ message: 'agrupacion inválida' });
  try {
    const resultado = await obtenerVentasPorPeriodo({ empresaId, fechaInicio, fechaFin, agrupacion, contactoId, productoId });
    return sendMovimientosPorPeriodo(res, resultado, formato, 'Ventas por Período', 'Cliente', 'ventas-por-periodo', !!productoId);
  } catch (err: unknown) {
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Error' });
  }
}

// ── Historial de Precios de Venta ─────────────────────────────────────────────

const COLUMNAS_HISTORIAL_PRECIOS_VENTA: ExportColumna[] = [
  { field: 'fecha',            headerName: 'Fecha'           },
  { field: 'proveedor_nombre', headerName: 'Cliente'         },
  { field: 'folio',            headerName: 'Documento'       },
  { field: 'clave',            headerName: 'Clave'           },
  { field: 'descripcion',      headerName: 'Descripción'     },
  { field: 'cantidad',         headerName: 'Cantidad'        },
  { field: 'precio_unitario',  headerName: 'Precio Unitario' },
  { field: 'subtotal',         headerName: 'Subtotal'        },
];

export async function getHistorialPreciosVenta(req: Request, res: Response) {
  const { empresaId, fechaInicio, fechaFin, productoId, contactoId, formato } = parseHistorialPreciosParams(req);
  if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
  if (!fechaInicio || !fechaFin) return res.status(400).json({ message: 'fecha_inicio y fecha_fin son requeridos' });
  try {
    const resultado = await obtenerHistorialPreciosVenta({ empresaId, fechaInicio, fechaFin, productoId, contactoId });

    if (formato === 'excel') {
      const filas = resultado.lineas.map((l) => ({ ...l, fecha: fmtFechaMX(l.fecha) }));
      const buffer = generarExcelBuffer(filas, COLUMNAS_HISTORIAL_PRECIOS_VENTA, 'Historial de Precios de Venta');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="historial-precios-venta.xlsx"');
      return res.send(buffer);
    }

    if (formato === 'pdf') {
      const buffer = await generarHistorialPreciosPDF(resultado, 'Historial de Precios de Venta', 'Cliente', 'PRECIO');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="historial-precios-venta.pdf"');
      return res.send(buffer);
    }

    return res.json(resultado);
  } catch (err: unknown) {
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Error' });
  }
}

// ── Pendientes de Facturar ────────────────────────────────────────────────────

function buildColsPendientesFacturar(docLabel: string, conAvance: boolean): ExportColumna[] {
  const cols: ExportColumna[] = [
    { field: 'fecha',           headerName: 'Fecha'               },
    { field: 'folio',           headerName: 'Folio'               },
    { field: 'cliente_nombre',  headerName: 'Cliente'             },
    { field: 'total_doc',       headerName: `Total ${docLabel}`   },
    { field: 'total_facturado', headerName: 'Facturado'           },
    { field: 'total_pendiente', headerName: 'Pendiente'           },
  ];
  if (conAvance) cols.push({ field: 'pct_avance', headerName: '% Avance' });
  return cols;
}

async function sendPendientesFacturar(
  res: Response,
  resultado: PendientesFacturarResult,
  formato: string,
  titulo: string,
  docLabel: string,
  conAvance: boolean,
  fileSlug: string
) {
  if (formato === 'json') return res.json(resultado);

  if (formato === 'pdf') {
    const buffer = await generarPendientesFacturarPDF(resultado, titulo, docLabel, conAvance);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileSlug}.pdf"`);
    return res.send(buffer);
  }

  if (formato === 'excel') {
    const filas = resultado.documentos.map((d) => ({ ...d, fecha: fmtFechaMX(d.fecha) }));
    const columnas = buildColsPendientesFacturar(docLabel, conAvance);
    const buffer = generarExcelBuffer(filas, columnas, titulo);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileSlug}.xlsx"`);
    return res.send(buffer);
  }

  return res.status(400).json({ message: 'Formato no soportado' });
}

function parsePendientesFacturarParams(req: Request) {
  const empresaId   = req.context?.empresaId as number | undefined;
  const hoy         = new Date().toISOString().slice(0, 10);
  const primerDia   = `${hoy.slice(0, 7)}-01`;
  const fechaInicio = (req.query.fecha_inicio as string) || primerDia;
  const fechaFin    = (req.query.fecha_fin    as string) || hoy;
  const contactoId  = req.query.contacto_id ? Number(req.query.contacto_id) : null;
  const formato     = ((req.query.formato as string) || 'json').toLowerCase();
  return { empresaId, fechaInicio, fechaFin, contactoId, formato };
}

export async function getPedidosPendientesFacturar(req: Request, res: Response) {
  const { empresaId, fechaInicio, fechaFin, contactoId, formato } = parsePendientesFacturarParams(req);
  if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
  if (!fechaInicio || !fechaFin) return res.status(400).json({ message: 'fecha_inicio y fecha_fin son requeridos' });
  try {
    const resultado = await obtenerPedidosPendientesFacturar({ empresaId, fechaInicio, fechaFin, contactoId });
    return sendPendientesFacturar(res, resultado, formato, 'Pedidos Pendientes de Facturar', 'Pedido', true, 'pedidos-pendientes-facturar');
  } catch (err: unknown) {
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Error' });
  }
}

export async function getRemisionesPendientesFacturar(req: Request, res: Response) {
  const { empresaId, fechaInicio, fechaFin, contactoId, formato } = parsePendientesFacturarParams(req);
  if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
  if (!fechaInicio || !fechaFin) return res.status(400).json({ message: 'fecha_inicio y fecha_fin son requeridos' });
  try {
    const resultado = await obtenerRemisionesPendientesFacturar({ empresaId, fechaInicio, fechaFin, contactoId });
    return sendPendientesFacturar(res, resultado, formato, 'Remisiones Pendientes de Facturar', 'Remisión', false, 'remisiones-pendientes-facturar');
  } catch (err: unknown) {
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Error' });
  }
}

export async function getVencimientosProveedores(req: Request, res: Response) {
  const { empresaId, fechaCorte, contactoId, moneda, formato } = parseVencimientosParams(req);
  if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
  try {
    const resultado = await obtenerVencimientosProveedores({ empresaId, fechaCorte, contactoId, moneda });

    if (formato === 'excel') {
      const filas = resultado.vencimientos.map((v) => ({
        ...v,
        fecha_vencimiento: fmtFechaMX(v.fecha_vencimiento),
      }));
      const buffer = generarExcelBuffer(filas, COLUMNAS_VENCIMIENTOS, 'Vencimientos de Proveedores');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="vencimientos-proveedores.xlsx"');
      return res.send(buffer);
    }

    if (formato === 'pdf') {
      const buffer = await generarVencimientosProveedoresPDF(resultado);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="vencimientos-proveedores.pdf"');
      return res.send(buffer);
    }

    return res.json(resultado);
  } catch (err: unknown) {
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Error' });
  }
}
