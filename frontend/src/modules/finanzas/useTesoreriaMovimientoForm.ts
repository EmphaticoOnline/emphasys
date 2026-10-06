import { useEffect, useMemo, useState } from 'react';
import type { Contacto } from '../../types/contactos.types';
import type { Concepto, FinanzasCuenta, FinanzasMetodoPago, FinanzasOperacion, TipoMovimiento } from '../../types/finanzas';
import { fetchConceptos } from '../../services/conceptosService';
import { fetchContactos } from '../../services/contactosService';
import { actualizarOperacion, actualizarTransferencia, crearOperacion, crearTransferencia, fetchMetodosPago } from '../../services/finanzasService';
import { fechaCivil, validarBorradorCaptura } from './capturaMovimientoLogica';
import {
  ETIQUETA_CONCEPTO_TRANSFERENCIA,
  construirOpcionesContacto,
  esTransferenciaOperacion,
  ladoCapturaTransferencia,
  opcionTransferenciaSeleccionada,
  reconstruirLadosTransferencia,
  validarTransferencia,
  type OpcionContactoTesoreria,
} from './transferenciaLogica';

type OpcionContacto = { id: number; nombre: string };
type OpcionConcepto = { id: number; nombre_concepto: string };

export type GuardadoMovimiento =
  | { tipo: 'operacion'; id: number }
  | { tipo: 'transferencia'; transferenciaId: number };

export function useTesoreriaMovimientoForm(opts: {
  operacion: FinanzasOperacion | null;
  cuentaInicialId: number | null;
  cuentas: FinanzasCuenta[];
  onGuardada: (cuentaId: number) => Promise<void> | void;
}) {
  const { operacion, cuentaInicialId, cuentas, onGuardada } = opts;
  const ladosIniciales = esTransferenciaOperacion(operacion) && operacion
    ? reconstruirLadosTransferencia(operacion)
    : null;
  const ladoInicial = ladosIniciales && operacion ? ladoCapturaTransferencia(operacion, ladosIniciales) : 'origen';
  const [lado, setLado] = useState<'origen' | 'destino'>(ladoInicial);
  const [origenFijoId, setOrigenFijoId] = useState<number | null>(ladosIniciales?.origenId ?? null);
  const [cuentaId, setCuentaIdEstado] = useState<number | null>(operacion?.cuenta_id ?? cuentaInicialId);
  const [tipo, setTipo] = useState<TipoMovimiento>(operacion?.tipo_movimiento === 'Deposito' ? 'Deposito' : 'Retiro');
  const [monto, setMonto] = useState(operacion ? String(Math.abs(Number(operacion.monto) || 0) || '') : '');
  const [fecha, setFecha] = useState(operacion?.fecha ? String(operacion.fecha).slice(0, 10) : fechaCivil());
  const [referencia, setReferencia] = useState(operacion?.referencia ?? '');
  const [contactoId, setContactoId] = useState<number | null>(ladosIniciales ? null : operacion?.contacto_id ?? null);
  const [conceptoId, setConceptoId] = useState<number | null>(ladosIniciales ? null : operacion?.concepto_id ?? null);
  const [destinoId, setDestinoId] = useState<number | null>(ladosIniciales?.destinoId ?? null);
  const [transferenciaId, setTransferenciaId] = useState<number | null>(ladosIniciales?.transferenciaId ?? null);
  const [contactos, setContactos] = useState<OpcionContacto[]>([]);
  const [conceptos, setConceptos] = useState<OpcionConcepto[]>([]);
  const [metodos, setMetodos] = useState<FinanzasMetodoPago[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idPersistida, setIdPersistida] = useState<number | null>(operacion?.id ?? null);
  const metodoPagoId = operacion?.metodo_pago_id ?? null;
  const modoTransferencia = destinoId != null || transferenciaId != null;

  useEffect(() => {
    let vivo = true;
    Promise.all([
      fetchConceptos().catch(() => [] as Concepto[]),
      fetchContactos().catch(() => [] as Contacto[]),
      metodoPagoId ? fetchMetodosPago(true).catch(() => [] as FinanzasMetodoPago[]) : Promise.resolve([] as FinanzasMetodoPago[]),
    ]).then(([listaConceptos, listaContactos, listaMetodos]) => {
      if (!vivo) return;
      setConceptos(
        listaConceptos
          .filter((item) => item.activo)
          .map((item) => ({ id: item.id, nombre_concepto: item.nombre_concepto })),
      );
      setContactos(listaContactos.map((item) => ({ id: item.id, nombre: item.nombre || '' })));
      setMetodos(listaMetodos);
    });
    return () => {
      vivo = false;
    };
  }, [metodoPagoId]);

  const metodo = metodoPagoId == null ? null : metodos.find((item) => item.id === metodoPagoId);

  const evaluarMovimiento = () => validarBorradorCaptura({
    cuentaId,
    fecha,
    salida: tipo === 'Retiro' ? monto : '',
    ingreso: tipo === 'Deposito' ? monto : '',
    referencia,
    contactoId,
    conceptoId,
    metodoPagoId,
    observaciones: operacion?.observaciones ?? null,
    naturaleza: operacion?.naturaleza_operacion,
    documentoOrigenId: operacion?.documento_origen_id ?? null,
    metodo,
  });

  const contraparteId = !modoTransferencia ? null : lado === 'destino' ? origenFijoId : destinoId;
  const origenGuardado = transferenciaId && lado === 'destino' ? origenFijoId : cuentaId;
  const destinoGuardado = transferenciaId && lado === 'destino' ? cuentaId : destinoId;

  const evaluarTransferencia = () => validarTransferencia({
    cuentaOrigenId: origenGuardado,
    cuentaDestinoId: destinoGuardado,
    fecha,
    monto,
    referencia,
    observaciones: operacion?.observaciones || '',
  });

  const resultado = useMemo(
    () => (modoTransferencia ? evaluarTransferencia() : evaluarMovimiento()),
    [cuentaId, conceptoId, contactoId, destinoGuardado, destinoId, fecha, metodo, metodoPagoId, modoTransferencia, monto, operacion, origenGuardado, referencia, tipo],
  );

  const opcionesContacto = useMemo(
    () => construirOpcionesContacto({
      contactos,
      cuentas,
      cuentaOrigenId: cuentaId,
      cuentaDestinoId: contraparteId,
      modo: operacion == null ? 'alta' : modoTransferencia ? 'transferencia' : 'movimiento',
    }),
    [contactos, contraparteId, cuentaId, cuentas],
  );

  const opcionContacto = modoTransferencia
    ? opcionTransferenciaSeleccionada(cuentas, contraparteId)
    : opcionesContacto.find((opcion) => opcion.tipo === 'contacto' && opcion.contactoId === contactoId) ?? null;

  const contactoNombre = opcionContacto?.etiqueta
    || (contactoId != null && operacion?.contacto_id === contactoId ? operacion.contacto_nombre || '' : '');
  const conceptoNombre = modoTransferencia
    ? ETIQUETA_CONCEPTO_TRANSFERENCIA
    : conceptoId == null
      ? ''
      : conceptos.find((item) => item.id === conceptoId)?.nombre_concepto
        || (operacion?.concepto_id === conceptoId ? operacion.concepto_nombre || '' : '');

  const setCuentaId = (id: number | null) => {
    setCuentaIdEstado(id);
    if (transferenciaId && lado === 'destino') {
      setDestinoId(id);
      setOrigenFijoId((actual) => (actual != null && actual === id ? null : actual));
      return;
    }
    setDestinoId((actual) => (actual != null && actual === id ? null : actual));
  };

  const seleccionarContacto = (opcion: OpcionContactoTesoreria) => {
    if (opcion.tipo === 'transferencia' && opcion.cuentaId != null) {
      setContactoId(null);
      setConceptoId(null);
      if (transferenciaId && lado === 'destino') setOrigenFijoId(opcion.cuentaId);
      else {
        setDestinoId(opcion.cuentaId);
        setLado('origen');
        setTipo('Retiro');
      }
      setError(null);
      return;
    }
    if (transferenciaId) {
      setError('Esta transferencia se actualiza eligiendo otra cuenta. No pasa a ser un movimiento general.');
      return;
    }
    setDestinoId(null);
    setContactoId(opcion.contactoId);
    setError(null);
  };

  const guardar = async (): Promise<GuardadoMovimiento | null> => {
    if (guardando) return null;
    if (transferenciaId || destinoId != null || esTransferenciaOperacion(operacion)) {
      const actual = evaluarTransferencia();
      if (!actual.ok) {
        setError(actual.mensaje);
        return null;
      }
      if (!transferenciaId && operacion?.id) {
        setError('Un movimiento ya registrado no se convierte en transferencia desde aquí.');
        return null;
      }
      setGuardando(true);
      setError(null);
      try {
        if (transferenciaId) {
          await actualizarTransferencia(transferenciaId, actual.payload);
          await onGuardada(actual.payload.cuenta_origen_id);
          return { tipo: 'transferencia', transferenciaId };
        }
        const creada = await crearTransferencia(actual.payload) as { transferencia?: { id?: number } };
        const nuevoId = Number(creada?.transferencia?.id);
        if (Number.isFinite(nuevoId) && nuevoId > 0) setTransferenciaId(nuevoId);
        await onGuardada(actual.payload.cuenta_origen_id);
        return { tipo: 'transferencia', transferenciaId: nuevoId };
      } catch (err: unknown) {
        const mensaje = err instanceof Error ? err.message : 'No se pudo guardar la transferencia';
        setError(mensaje);
        return null;
      } finally {
        setGuardando(false);
      }
    }

    const actual = evaluarMovimiento();
    if (!actual.ok) {
      setError(actual.mensaje);
      return null;
    }
    setGuardando(true);
    setError(null);
    try {
      const guardada = idPersistida
        ? await actualizarOperacion(idPersistida, actual.payload)
        : await crearOperacion(actual.payload);
      setIdPersistida(guardada.id);
      await onGuardada(actual.payload.cuenta_id);
      return { tipo: 'operacion', id: guardada.id };
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : 'No se pudo guardar la operación';
      setError(mensaje);
      return null;
    } finally {
      setGuardando(false);
    }
  };

  return {
    cuentaId,
    setCuentaId,
    tipo,
    setTipo,
    monto,
    setMonto,
    fecha,
    setFecha,
    referencia,
    setReferencia,
    contactoId,
    conceptoId,
    setConceptoId,
    contactos,
    conceptos,
    opcionesContacto,
    seleccionarContacto,
    claveContacto: opcionContacto?.clave ?? null,
    modoTransferencia,
    guardando,
    error,
    setError,
    listo: resultado.ok,
    idPersistida,
    transferenciaId,
    referenciaObligatoria: Boolean(metodo?.requiere_referencia) && !modoTransferencia,
    contactoNombre,
    conceptoNombre,
    guardar,
  };
}
