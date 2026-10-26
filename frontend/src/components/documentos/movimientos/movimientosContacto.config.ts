import type { CotizacionListado } from '../../../types/cotizacion';
import type { TipoDocumento } from '../../../types/documentos.types';
import type { StatusTone } from '../../status/status.types';
import { estadoVisualDocumento } from '../estadoVisualDocumento';
import { getEstadoSeguimientoPresentation } from '../../../modules/cotizaciones/estadoSeguimiento';

export type EstatusMovimiento = { label: string; tone: StatusTone };

/**
 * Describe un tipo de movimiento que puede mostrarse como pestaña en el
 * workspace de un contacto. Para agregar pedidos, órdenes de compra, pagos,
 * notas de crédito, etc. basta con añadir una entrada a MOVIMIENTOS_CONTACTO.
 */
export type MovimientoContactoConfig = {
  tipoDocumento: TipoDocumento;
  /** Etiqueta de la pestaña (plural). */
  etiqueta: string;
  /** Texto del estado vacío. */
  vacio: string;
  /** Ruta del formulario del documento. */
  ruta: (row: CotizacionListado) => string;
  mostrarSaldo: boolean;
  mostrarVencimiento: boolean;
  estatus: (row: CotizacionListado) => EstatusMovimiento;
};

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
    ruta: (row) => `/ventas/cotizacion/${row.id}`,
    mostrarSaldo: false,
    mostrarVencimiento: true,
    estatus: (row) => {
      const presentacion = getEstadoSeguimientoPresentation(row.estado_seguimiento);
      return { label: presentacion.label, tone: TONO_SEGUIMIENTO[String(presentacion.value ?? '')] ?? 'neutral' };
    },
  },
  {
    tipoDocumento: 'factura',
    etiqueta: 'Facturas',
    vacio: 'Sin facturas registradas.',
    ruta: (row) => `/ventas/factura/${row.id}`,
    mostrarSaldo: true,
    mostrarVencimiento: true,
    estatus: (row) => estadoVisualDocumento(row),
  },
];
