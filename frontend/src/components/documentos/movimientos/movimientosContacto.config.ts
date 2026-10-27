import type { CotizacionListado } from '../../../types/cotizacion';
import type { TipoDocumento } from '../../../types/documentos.types';
import type { StatusTone } from '../../status/status.types';
import { estadoVisualDocumento } from '../estadoVisualDocumento';
import { getEstadoSeguimientoPresentation } from '../../../modules/cotizaciones/estadoSeguimiento';

export type EstatusMovimiento = { label: string; tone: StatusTone };

/**
 * Describe un tipo de movimiento que puede mostrarse como pestaña en el
 * workspace de un contacto. Para agregar otro tipo (p. ej. órdenes de compra)
 * basta con añadir una entrada a MOVIMIENTOS_CONTACTO.
 */
export type MovimientoContactoConfig = {
  tipoDocumento: TipoDocumento;
  /** Etiqueta de la pestaña (plural). */
  etiqueta: string;
  /** Texto del estado vacío. */
  vacio: string;
  mostrarSaldo: boolean;
  mostrarVencimiento: boolean;
  /** Etiquetas de las cifras del encabezado. */
  etiquetaTotal: string;
  etiquetaSaldo: string;
  /**
   * Qué se despliega al expandir: partidas del documento, aplicaciones del
   * pago, o el detalle de una nota de crédito (cambia según su motivo).
   */
  contenido: 'partidas' | 'aplicaciones' | 'nota_credito';
  estatus: (row: CotizacionListado) => EstatusMovimiento;
  /** Dato adicional del encabezado (p. ej. el motivo de una nota de crédito). */
  datoExtra?: (row: CotizacionListado) => { label: string; valor: string } | null;
};

const normalizar = (value: unknown) => String(value ?? '').trim().toLowerCase();

export const MOTIVOS_NOTA_CREDITO: Record<string, string> = {
  devolucion: 'Devolución',
  bonificacion: 'Bonificación',
  otro: 'Otro',
};

/** Mismas etiquetas que el workspace de Notas de crédito. */
function estatusNotaCredito(row: CotizacionListado, fiscal: boolean): EstatusMovimiento {
  const estatus = normalizar(row.estatus_documento);
  const label = estatus === 'borrador' ? 'Borrador'
    : estatus === 'emitido' ? 'Emitida'
      : estatus === 'timbrado' ? 'Timbrada'
        : estatus === 'cancelado' || estatus === 'cancelada' ? 'Cancelada'
          : row.estatus_documento || 'Sin estado';
  if (estatus === 'cancelado' || estatus === 'cancelada') return { label, tone: 'error' };
  if (estatus === 'borrador') return { label, tone: 'draft' };
  // Venta: el punto sigue el CFDI de egreso. Compra: el CFDI lo emite el proveedor.
  if (fiscal) return { label, tone: estadoVisualDocumento(row).tone };
  return { label, tone: 'success' };
}

const motivoNotaCredito = (row: CotizacionListado) => ({
  label: 'Motivo',
  valor: MOTIVOS_NOTA_CREDITO[normalizar(row.motivo_nc)] ?? 'Sin motivo',
});

/** Mismas etiquetas que el workspace de Pagos. */
function estatusPago(row: CotizacionListado, conComplemento: boolean): EstatusMovimiento {
  const estatus = normalizar(row.estatus_documento);
  const label = estatus === 'borrador' ? 'Borrador'
    : estatus === 'emitido' ? 'Emitido'
      : estatus === 'timbrado' ? 'Timbrado'
        : estatus === 'cancelado' || estatus === 'cancelada' ? 'Cancelado'
          : row.estatus_documento || 'Sin estado';
  if (estatus === 'cancelado' || estatus === 'cancelada') return { label, tone: 'error' };
  if (estatus === 'borrador') return { label, tone: 'draft' };
  // Pago de cliente: el punto sigue el estado del complemento (CFDI), como en el workspace.
  if (conComplemento) return { label, tone: estadoVisualDocumento(row).tone };
  return { label, tone: 'success' };
}

/** Documentos sin CFDI (pedidos, órdenes, remisiones): sólo su estatus operativo. */
function estatusOperativo(row: CotizacionListado, femenino: boolean): EstatusMovimiento {
  const estatus = normalizar(row.estatus_documento);
  const o = femenino ? 'a' : 'o';
  if (estatus === 'cancelado' || estatus === 'cancelada') return { label: `Cancelad${o}`, tone: 'error' };
  if (estatus === 'borrador') return { label: 'Borrador', tone: 'draft' };
  if (estatus === 'emitido' || estatus === 'emitida') return { label: `Emitid${o}`, tone: 'success' };
  return { label: row.estatus_documento || 'Sin estado', tone: 'neutral' };
}

/** Pedidos, órdenes de servicio y remisiones: mismo formato, sin saldo ni vencimiento. */
const documentoOperativo = (
  tipoDocumento: TipoDocumento,
  etiqueta: string,
  femenino: boolean,
): MovimientoContactoConfig => ({
  tipoDocumento,
  etiqueta,
  vacio: `Sin ${etiqueta.toLowerCase()} registrad${femenino ? 'a' : 'o'}s.`,
  mostrarSaldo: false,
  mostrarVencimiento: false,
  etiquetaTotal: 'Total',
  etiquetaSaldo: 'Saldo pendiente',
  contenido: 'partidas',
  estatus: (row) => estatusOperativo(row, femenino),
});

const TONO_SEGUIMIENTO: Record<string, StatusTone> = {
  abierta: 'info',
  pausada: 'warning',
  convertida: 'success',
  perdida: 'error',
  'no seleccionada': 'neutral',
  cancelada: 'blocked',
};

export const MOVIMIENTOS_CONTACTO: MovimientoContactoConfig[] = [
  {
    tipoDocumento: 'cotizacion',
    etiqueta: 'Cotizaciones',
    vacio: 'Sin cotizaciones registradas.',
    mostrarSaldo: false,
    mostrarVencimiento: true,
    etiquetaTotal: 'Total',
    etiquetaSaldo: 'Saldo pendiente',
    contenido: 'partidas',
    estatus: (row) => {
      const presentacion = getEstadoSeguimientoPresentation(row.estado_seguimiento);
      return { label: presentacion.label, tone: TONO_SEGUIMIENTO[String(presentacion.value ?? '')] ?? 'neutral' };
    },
  },
  // Mismo orden que el flujo de venta (documentoVisualOrder).
  documentoOperativo('pedido', 'Pedidos', false),
  documentoOperativo('orden_servicio', 'Órdenes de servicio', true),
  documentoOperativo('orden_entrega', 'Órdenes de entrega', true),
  documentoOperativo('remision', 'Remisiones', true),
  {
    tipoDocumento: 'factura',
    etiqueta: 'Facturas',
    vacio: 'Sin facturas registradas.',
    mostrarSaldo: true,
    mostrarVencimiento: true,
    etiquetaTotal: 'Total',
    etiquetaSaldo: 'Saldo pendiente',
    contenido: 'partidas',
    estatus: (row) => estadoVisualDocumento(row),
  },
  {
    tipoDocumento: 'pago_cliente',
    etiqueta: 'Pagos recibidos',
    vacio: 'Sin pagos recibidos.',
    mostrarSaldo: true,
    mostrarVencimiento: false,
    etiquetaTotal: 'Monto',
    etiquetaSaldo: 'Por aplicar',
    contenido: 'aplicaciones',
    estatus: (row) => estatusPago(row, true),
  },
  {
    tipoDocumento: 'nota_credito',
    etiqueta: 'Notas de crédito emitidas',
    vacio: 'Sin notas de crédito emitidas.',
    mostrarSaldo: true,
    mostrarVencimiento: false,
    etiquetaTotal: 'Importe',
    etiquetaSaldo: 'Disponible',
    contenido: 'nota_credito',
    estatus: (row) => estatusNotaCredito(row, true),
    datoExtra: motivoNotaCredito,
  },
  // Compras, en el orden de su flujo.
  documentoOperativo('requisicion', 'Requisiciones', true),
  documentoOperativo('orden_compra', 'Órdenes de compra', true),
  documentoOperativo('recepcion', 'Recepciones', true),
  {
    tipoDocumento: 'factura_compra',
    etiqueta: 'Facturas de compra',
    vacio: 'Sin facturas de compra registradas.',
    mostrarSaldo: true,
    mostrarVencimiento: true,
    etiquetaTotal: 'Total',
    etiquetaSaldo: 'Saldo pendiente',
    contenido: 'partidas',
    // El CFDI lo emite el proveedor: no aplica el estado de timbrado de las facturas de venta.
    estatus: (row) => estatusOperativo(row, true),
  },
  {
    tipoDocumento: 'pago_proveedor',
    etiqueta: 'Pagos realizados',
    vacio: 'Sin pagos realizados.',
    mostrarSaldo: true,
    mostrarVencimiento: false,
    etiquetaTotal: 'Monto',
    etiquetaSaldo: 'Por aplicar',
    contenido: 'aplicaciones',
    estatus: (row) => estatusPago(row, false),
  },
  {
    tipoDocumento: 'nota_credito_compra',
    etiqueta: 'Notas de crédito recibidas',
    vacio: 'Sin notas de crédito recibidas.',
    mostrarSaldo: true,
    mostrarVencimiento: false,
    etiquetaTotal: 'Importe',
    etiquetaSaldo: 'Disponible',
    contenido: 'nota_credito',
    estatus: (row) => estatusNotaCredito(row, false),
    datoExtra: motivoNotaCredito,
  },
];
