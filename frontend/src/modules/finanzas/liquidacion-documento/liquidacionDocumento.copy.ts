import type { TipoDocumento } from '../../../types/documentos.types';

export type LiquidacionModo = 'ventas' | 'compras';

export type LiquidacionTextos = {
  accionRegistrar: string;
  accionAplicarExistente: string;
  accionAdministrar: string;
  titulo: (folio: string) => string;
  contraparte: string;
  monto: string;
  otrasFacturas: string;
  saldoPorAplicar: string;
  guardar: string;
  guardadoOk: string;
  exceso: (importe: string) => string;
  notaComplemento: string | null;
  vacioOtras: string;
  estaFactura: string;
  cubierta: string;
  ayudaDisponible: string;
  ayudaCubierto: string;
  ayudaFaltaCuenta: string;
  estadoListo: string;
  estadoFaltaCuenta: string;
  estadoExceso: string;
};

export type LiquidacionConfig = {
  modo: LiquidacionModo;
  tipoOrigen: TipoDocumento;
  tipoMovimiento: TipoDocumento;
  tiposCargo: string[];
  textos: LiquidacionTextos;
};

export function resolveLiquidacionConfig(tipoOrigen: TipoDocumento): LiquidacionConfig | null {
  const tipo = String(tipoOrigen ?? '').toLowerCase();

  if (tipo === 'factura_compra') {
    return {
      modo: 'compras',
      tipoOrigen: 'factura_compra',
      tipoMovimiento: 'pago_proveedor',
      tiposCargo: ['factura_compra'],
      textos: {
        accionRegistrar: 'Registrar pago',
        accionAplicarExistente: 'Aplicar saldo existente',
        accionAdministrar: 'Administrar aplicaciones',
        titulo: (folio) => (folio ? `Pago a ${folio}` : 'Registrar pago'),
        contraparte: 'Proveedor',
        monto: 'Pago realizado',
        otrasFacturas: 'Otras facturas del proveedor',
        saldoPorAplicar: 'Saldo por aplicar',
        guardar: 'Guardar pago',
        guardadoOk: 'Pago registrado',
        exceso: (importe) =>
          `El total aplicado supera el monto del pago por ${importe}. Ajusta las aplicaciones antes de guardar.`,
        notaComplemento: null,
        vacioOtras: 'No hay otras facturas de compra pendientes para este proveedor y moneda.',
        estaFactura: 'Esta factura',
        cubierta: 'Cubierta',
        ayudaDisponible: 'Puedes guardar con saldo disponible. No se reparte solo.',
        ayudaCubierto: 'El monto quedó cubierto por las aplicaciones.',
        ayudaFaltaCuenta: 'Falta elegir cuenta / caja / banco.',
        estadoListo: 'Listo',
        estadoFaltaCuenta: 'Falta cuenta',
        estadoExceso: 'Bloqueado',
      },
    };
  }

  if (tipo === 'factura') {
    return {
      modo: 'ventas',
      tipoOrigen: 'factura',
      tipoMovimiento: 'pago_cliente',
      tiposCargo: ['factura'],
      textos: {
        accionRegistrar: 'Registrar cobro',
        accionAplicarExistente: 'Aplicar saldo existente',
        accionAdministrar: 'Administrar aplicaciones',
        titulo: (folio) => (folio ? `Cobro a ${folio}` : 'Registrar cobro'),
        contraparte: 'Cliente',
        monto: 'Cobro recibido',
        otrasFacturas: 'Otras facturas del cliente',
        saldoPorAplicar: 'Saldo por aplicar',
        guardar: 'Guardar cobro',
        guardadoOk: 'Cobro registrado',
        exceso: (importe) =>
          `El total aplicado supera el monto del cobro por ${importe}. Ajusta las aplicaciones antes de guardar.`,
        notaComplemento: 'El complemento de pago se genera después, si aplica. No forma parte de esta captura.',
        vacioOtras: 'No hay otras facturas pendientes para este cliente y moneda.',
        estaFactura: 'Esta factura',
        cubierta: 'Cubierta',
        ayudaDisponible: 'Puedes guardar con saldo disponible. No se reparte solo.',
        ayudaCubierto: 'El monto quedó cubierto por las aplicaciones.',
        ayudaFaltaCuenta: 'Falta elegir cuenta / caja / banco.',
        estadoListo: 'Listo',
        estadoFaltaCuenta: 'Falta cuenta',
        estadoExceso: 'Bloqueado',
      },
    };
  }

  return null;
}
