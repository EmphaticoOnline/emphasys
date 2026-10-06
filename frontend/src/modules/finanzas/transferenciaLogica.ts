import type { TransferenciaPayload } from '../../types/finanzas';

export const ETIQUETA_CONCEPTO_TRANSFERENCIA = 'Transferencia';

export function sanitizarMontoTransferencia(value: string) {
  return value.replace(/[^0-9.]/g, '');
}

export function etiquetaTransferencia(nombreCuenta: string) {
  return `Transfer: ${nombreCuenta}`;
}

export function esTransferenciaOperacion(op: {
  es_transferencia?: boolean;
  transferencia_id?: number | null;
} | null | undefined) {
  return Boolean(op && (op.es_transferencia || op.transferencia_id));
}

export type LadosTransferencia = {
  origenId: number;
  destinoId: number | null;
  transferenciaId: number | null;
};

/** La cuenta del formulario es el origen; el contacto Transfer: es el destino. */
export function reconstruirLadosTransferencia(op: {
  cuenta_id: number;
  tipo_movimiento?: string | null;
  transferencia_id?: number | null;
  transferencia_cuenta_origen?: number | null;
  transferencia_cuenta_destino?: number | null;
}): LadosTransferencia {
  const origen = op.transferencia_cuenta_origen ?? null;
  const destino = op.transferencia_cuenta_destino ?? null;
  if (origen && destino) {
    return { origenId: origen, destinoId: destino, transferenciaId: op.transferencia_id ?? null };
  }
  if (op.tipo_movimiento === 'Deposito') {
    return {
      origenId: origen ?? op.cuenta_id,
      destinoId: destino ?? (origen && origen !== op.cuenta_id ? op.cuenta_id : null),
      transferenciaId: op.transferencia_id ?? null,
    };
  }
  return {
    origenId: origen ?? op.cuenta_id,
    destinoId: destino,
    transferenciaId: op.transferencia_id ?? null,
  };
}

/** En la grilla no hay campo de cuenta: el lado editado conserva su columna de monto. */
export function ladoCapturaTransferencia(
  op: { cuenta_id: number; tipo_movimiento?: string | null },
  lados: LadosTransferencia,
): 'origen' | 'destino' {
  if (lados.destinoId != null && op.cuenta_id === lados.destinoId && op.cuenta_id !== lados.origenId) return 'destino';
  if (op.tipo_movimiento === 'Deposito' && op.cuenta_id !== lados.origenId) return 'destino';
  return 'origen';
}

export type CuentaParaTransferencia = {
  id: number;
  identificador: string;
  moneda?: string | null;
  cuenta_cerrada?: boolean;
};

export function cuentasDestinoTransferencia(
  cuentas: CuentaParaTransferencia[],
  cuentaOrigenId: number | null,
  cuentaDestinoActualId?: number | null,
) {
  const origen = cuentas.find((cuenta) => cuenta.id === cuentaOrigenId);
  const moneda = origen?.moneda || 'MXN';
  return cuentas.filter((cuenta) => {
    if (cuentaOrigenId != null && cuenta.id === cuentaOrigenId) return false;
    if (cuenta.cuenta_cerrada && cuenta.id !== cuentaDestinoActualId) return false;
    const mismaMoneda = (cuenta.moneda || 'MXN') === moneda;
    if (!mismaMoneda && cuenta.id !== cuentaDestinoActualId) return false;
    return true;
  });
}

export type ContactoSimple = { id: number; nombre: string };

export type OpcionContactoTesoreria = {
  tipo: 'contacto' | 'transferencia';
  clave: string;
  etiqueta: string;
  nombre: string;
  contactoId: number | null;
  cuentaId: number | null;
};

export type ModoOpcionesContactoTesoreria = 'alta' | 'movimiento' | 'transferencia';

export type VistaContraparteTransferencia = {
  cuenta_id: number;
  es_transferencia?: boolean;
  transferencia_id?: number | null;
  transferencia_cuenta_origen?: number | null;
  transferencia_cuenta_destino?: number | null;
  transferencia_origen_nombre?: string | null;
  transferencia_destino_nombre?: string | null;
};

/** Cuenta del otro lado, vista desde el movimiento que se está mostrando. */
export function idContraparteTransferencia(op: VistaContraparteTransferencia): number | null {
  const origen = op.transferencia_cuenta_origen ?? null;
  const destino = op.transferencia_cuenta_destino ?? null;
  if (destino != null && op.cuenta_id === destino && op.cuenta_id !== origen) return origen;
  return destino;
}

export function nombreContraparteTransferencia(
  op: VistaContraparteTransferencia,
  cuentas: CuentaParaTransferencia[] = [],
) {
  const origen = op.transferencia_cuenta_origen ?? null;
  const destino = op.transferencia_cuenta_destino ?? null;
  const enDestino = destino != null && op.cuenta_id === destino && op.cuenta_id !== origen;
  const directo = (enDestino ? op.transferencia_origen_nombre : op.transferencia_destino_nombre)?.trim();
  if (directo) return directo;
  return nombreCuentaTransferencia(cuentas, idContraparteTransferencia(op));
}

export function etiquetaContraparteTransferencia(
  op: VistaContraparteTransferencia,
  cuentas: CuentaParaTransferencia[] = [],
) {
  const nombre = nombreContraparteTransferencia(op, cuentas);
  return nombre ? etiquetaTransferencia(nombre) : 'Transferencia';
}

export function nombreCuentaTransferencia(cuentas: CuentaParaTransferencia[], cuentaId: number | null) {
  if (cuentaId == null) return '';
  return cuentas.find((cuenta) => cuenta.id === cuentaId)?.identificador || `Cuenta ${cuentaId}`;
}

export function construirOpcionesContacto(args: {
  contactos: ContactoSimple[];
  cuentas: CuentaParaTransferencia[];
  cuentaOrigenId: number | null;
  cuentaDestinoId?: number | null;
  modo: ModoOpcionesContactoTesoreria;
}): OpcionContactoTesoreria[] {
  const mostrarTransferencias = args.modo !== 'movimiento';
  const mostrarContactos = args.modo !== 'transferencia';
  const destinos = mostrarTransferencias
    ? cuentasDestinoTransferencia(args.cuentas, args.cuentaOrigenId, args.cuentaDestinoId)
    : [];
  const ids = new Set(destinos.map((cuenta) => cuenta.id));
  if (args.cuentaDestinoId != null && args.cuentaDestinoId !== args.cuentaOrigenId && !ids.has(args.cuentaDestinoId)) {
    destinos.push({
      id: args.cuentaDestinoId,
      identificador: nombreCuentaTransferencia(args.cuentas, args.cuentaDestinoId),
    });
  }
  const transferencias = destinos
    .map((cuenta) => {
      const nombre = cuenta.identificador || `Cuenta ${cuenta.id}`;
      return {
        tipo: 'transferencia' as const,
        clave: `transferencia:${cuenta.id}`,
        etiqueta: etiquetaTransferencia(nombre),
        nombre,
        contactoId: null,
        cuentaId: cuenta.id,
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const contactos = mostrarContactos ? args.contactos.map((contacto) => ({
    tipo: 'contacto' as const,
    clave: `contacto:${contacto.id}`,
    etiqueta: contacto.nombre || 'Sin nombre',
    nombre: contacto.nombre || 'Sin nombre',
    contactoId: contacto.id,
    cuentaId: null,
  })) : [];
  return [...transferencias, ...contactos];
}

export function opcionTransferenciaSeleccionada(
  cuentas: CuentaParaTransferencia[],
  cuentaDestinoId: number | null,
): OpcionContactoTesoreria | null {
  if (cuentaDestinoId == null) return null;
  const nombre = nombreCuentaTransferencia(cuentas, cuentaDestinoId);
  return {
    tipo: 'transferencia',
    clave: `transferencia:${cuentaDestinoId}`,
    etiqueta: etiquetaTransferencia(nombre),
    nombre,
    contactoId: null,
    cuentaId: cuentaDestinoId,
  };
}

export type BorradorTransferencia = {
  cuentaOrigenId: number | '' | null;
  cuentaDestinoId: number | '' | null;
  fecha: string;
  monto: string;
  referencia: string;
  observaciones: string;
};

export type ResultadoTransferencia =
  | { ok: true; payload: TransferenciaPayload }
  | { ok: false; mensaje: string };

/** Mismas comprobaciones que TransferenciaDialog antes de llamar al servicio. */
export function validarTransferencia(borrador: BorradorTransferencia): ResultadoTransferencia {
  const montoNumerico = sanitizarMontoTransferencia(borrador.monto);
  const monto = Number(montoNumerico);
  if (!borrador.cuentaOrigenId || !borrador.cuentaDestinoId || !borrador.fecha || !montoNumerico || !Number.isFinite(monto) || monto <= 0) {
    return { ok: false, mensaje: 'Completa la cuenta destino, la fecha y un monto mayor que cero.' };
  }
  if (Number(borrador.cuentaOrigenId) === Number(borrador.cuentaDestinoId)) {
    return { ok: false, mensaje: 'Selecciona cuentas distintas.' };
  }
  return {
    ok: true,
    payload: {
      cuenta_origen_id: Number(borrador.cuentaOrigenId),
      cuenta_destino_id: Number(borrador.cuentaDestinoId),
      fecha: borrador.fecha,
      monto: Number(montoNumerico),
      referencia: borrador.referencia || null,
      observaciones: borrador.observaciones || null,
    },
  };
}
