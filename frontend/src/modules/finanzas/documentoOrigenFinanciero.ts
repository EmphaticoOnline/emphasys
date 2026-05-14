import type { NaturalezaOperacion, TipoMovimiento } from '../../types/finanzas';

export type DocumentoOrigenFinancieroConfig = {
  flujo: 'ventas' | 'compras';
  tipo_movimiento: TipoMovimiento;
  naturaleza_operacion: Exclude<NaturalezaOperacion, 'movimiento_general'>;
  accionLabel: string;
  totalLabel: string;
  anticiposLabel: string;
  disponibleLabel: string;
  pendienteLabel: string;
  dialogTitle: string;
};

const CONFIG_BY_DOCUMENTO: Record<string, DocumentoOrigenFinancieroConfig> = {
  cotizacion: {
    flujo: 'ventas',
    tipo_movimiento: 'Deposito',
    naturaleza_operacion: 'cobro_cliente',
    accionLabel: 'Recibir anticipo',
    totalLabel: 'Total documento',
    anticiposLabel: 'Anticipos recibidos',
    disponibleLabel: 'Disponible por aplicar',
    pendienteLabel: 'Pendiente estimado',
    dialogTitle: 'Registrar anticipo de cliente',
  },
  pedido: {
    flujo: 'ventas',
    tipo_movimiento: 'Deposito',
    naturaleza_operacion: 'cobro_cliente',
    accionLabel: 'Recibir anticipo',
    totalLabel: 'Total documento',
    anticiposLabel: 'Anticipos recibidos',
    disponibleLabel: 'Disponible por aplicar',
    pendienteLabel: 'Pendiente estimado',
    dialogTitle: 'Registrar anticipo de cliente',
  },
  orden_servicio: {
    flujo: 'ventas',
    tipo_movimiento: 'Deposito',
    naturaleza_operacion: 'cobro_cliente',
    accionLabel: 'Recibir anticipo',
    totalLabel: 'Total documento',
    anticiposLabel: 'Anticipos recibidos',
    disponibleLabel: 'Disponible por aplicar',
    pendienteLabel: 'Pendiente estimado',
    dialogTitle: 'Registrar anticipo de cliente',
  },
  orden_compra: {
    flujo: 'compras',
    tipo_movimiento: 'Retiro',
    naturaleza_operacion: 'pago_proveedor',
    accionLabel: 'Registrar anticipo',
    totalLabel: 'Total orden',
    anticiposLabel: 'Anticipos pagados',
    disponibleLabel: 'Disponible por aplicar',
    pendienteLabel: 'Pendiente estimado',
    dialogTitle: 'Registrar anticipo a proveedor',
  },
};

export function getDocumentoOrigenFinancieroConfig(tipoDocumento: string | null | undefined): DocumentoOrigenFinancieroConfig | null {
  const normalizado = String(tipoDocumento ?? '').trim().toLowerCase();
  return normalizado ? CONFIG_BY_DOCUMENTO[normalizado] ?? null : null;
}