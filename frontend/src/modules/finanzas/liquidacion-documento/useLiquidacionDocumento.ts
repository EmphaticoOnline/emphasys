import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CotizacionCrearPayload } from '../../../types/cotizacion';
import type { TipoDocumento } from '../../../types/documentos.types';
import type { EstadoCuentaItem, FinanzasCuenta } from '../../../types/finanzas';
import { createDocumento, getDocumento } from '../../../services/documentosService';
import { fetchCuentas, fetchEstadoCuenta, fetchSaldoDocumento } from '../../../services/finanzasService';
import { formatearFolioDocumento, resolverFolioVisual } from '../../../utils/documentos.utils';
import { resolveLiquidacionConfig, type LiquidacionConfig } from './liquidacionDocumento.copy';
import { parseMoneyInput, roundMoney, toCivilDate } from './liquidacionDocumento.money';

export type LiquidacionFila = {
  id: number;
  folio: string;
  fecha: string;
  saldo: number;
  esOrigen: boolean;
  moneda: string;
};

export type LiquidacionDocumentoParams = {
  documentoId: number;
  contactoId: number;
  tipoDocumento: TipoDocumento;
  saldoInicial?: number;
  folioInicial?: string;
  contactoNombreInicial?: string;
  monedaInicial?: string;
  empresaId?: number | null;
  usuarioId?: number | null;
};

export function getCuentaFinancieraDisplayLabel(cuenta: FinanzasCuenta) {
  const raw = String(cuenta.identificador ?? '').trim();
  const sanitized = raw
    .replace(/\b(clabe|clave|cuenta|cta\.?|numero|num\.?)(\s|:|-)*\d[\d\s-]*/gi, '')
    .replace(/(^|\s|-|\/)(\d[\d\s-]{3,})(?=$|\s|-|\/)/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s\-/:,]+$/g, '')
    .trim();

  return sanitized || raw || `Cuenta ${cuenta.id}`;
}

export function useLiquidacionDocumento(params: LiquidacionDocumentoParams | null) {
  const documentoId = params?.documentoId ?? 0;
  const contactoIdParam = params?.contactoId ?? 0;
  const tipoDocumento = params?.tipoDocumento;
  const saldoInicial = params?.saldoInicial;
  const folioInicial = params?.folioInicial;
  const contactoNombreInicial = params?.contactoNombreInicial;
  const monedaInicial = params?.monedaInicial;
  const empresaId = params?.empresaId;
  const usuarioId = params?.usuarioId;

  const config = useMemo(
    () => (tipoDocumento ? resolveLiquidacionConfig(tipoDocumento) : null),
    [tipoDocumento]
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [folio, setFolio] = useState(folioInicial ?? '');
  const [contactoNombre, setContactoNombre] = useState(contactoNombreInicial ?? '');
  const [contactoId, setContactoId] = useState(contactoIdParam);
  const [origenId, setOrigenId] = useState(documentoId);
  const [origenSaldo, setOrigenSaldo] = useState(Number(saldoInicial ?? 0));
  const [moneda, setMoneda] = useState((monedaInicial || 'MXN').toUpperCase());
  const [tipoCambio, setTipoCambio] = useState(1);
  const [fechaDocumento, setFechaDocumento] = useState(toCivilDate());
  const [monto, setMonto] = useState(Number(params?.saldoInicial ?? 0));
  const [cuentaFinancieraId, setCuentaFinancieraId] = useState<number | null>(null);
  const [formaPago, setFormaPago] = useState('');
  const [referencia, setReferencia] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [cuentas, setCuentas] = useState<FinanzasCuenta[]>([]);
  const [filas, setFilas] = useState<LiquidacionFila[]>([]);
  const [aplicaciones, setAplicaciones] = useState<Record<number, number>>({});
  const [distributionIsManual, setDistributionIsManual] = useState(false);
  const distributionIsManualRef = useRef(false);

  const marcarDistribucionManual = useCallback(() => {
    distributionIsManualRef.current = true;
    setDistributionIsManual(true);
  }, []);

  const formatter = useMemo(
    () => new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda || 'MXN', minimumFractionDigits: 2 }),
    [moneda]
  );

  const load = useCallback(async () => {
    if (!documentoId || !contactoIdParam || !tipoDocumento || !config) return;
    setLoading(true);
    setError(null);
    try {
      const [documentoData, saldoData, cuentasData, estadoCuenta] = await Promise.all([
        getDocumento(documentoId, tipoDocumento),
        fetchSaldoDocumento(documentoId),
        fetchCuentas(),
        fetchEstadoCuenta(contactoIdParam),
      ]);

      const documento = documentoData.documento as typeof documentoData.documento & {
        nombre_cliente?: string | null;
        cliente_nombre?: string | null;
        nombre_receptor?: string | null;
      };
      const folioDoc = resolverFolioVisual(documento, tipoDocumento)
        || formatearFolioDocumento(documento.serie || '', documento.numero || 0);
      const nombre = String(
        documento.nombre_cliente || documento.cliente_nombre || documento.nombre_receptor || contactoNombreInicial || ''
      ).trim();
      const monedaDoc = String(documento.moneda || saldoData?.moneda || monedaInicial || 'MXN').trim().toUpperCase() || 'MXN';
      const saldoOrigen = roundMoney(Number(saldoData?.saldo ?? saldoInicial ?? 0));
      const contactoDoc = Number(documento.contacto_principal_id ?? contactoIdParam) || contactoIdParam;

      if (saldoData?.cobro_bloqueado) {
        throw new Error('El saldo de este documento está suspendido. No admite nuevas aplicaciones.');
      }
      if (!(saldoOrigen > 0)) {
        throw new Error('Este documento ya no tiene saldo pendiente.');
      }
      if (!(contactoDoc > 0)) {
        throw new Error(`Selecciona un ${config.textos.contraparte.toLowerCase()} válido en el documento origen.`);
      }

      const otras = (estadoCuenta ?? [])
        .filter((item) => item.origen === 'documento' && Number(item.saldo ?? 0) > 0)
        .filter((item) => config.tiposCargo.includes(String(item.tipo ?? '').trim().toLowerCase()))
        .filter((item) => Number(item.id) !== Number(documentoId))
        .filter((item) => String(item.moneda ?? '').trim().toUpperCase() === monedaDoc)
        .sort((a, b) => String(a.fecha ?? '').localeCompare(String(b.fecha ?? '')))
        .map((item) => mapEstadoCuentaToFila(item, false));

      const origenFila: LiquidacionFila = {
        id: Number(documentoId),
        folio: folioDoc || `#${documentoId}`,
        fecha: String(documento.fecha_documento ?? '').slice(0, 10),
        saldo: saldoOrigen,
        esOrigen: true,
        moneda: monedaDoc,
      };

      const montoInicial = saldoOrigen;
      const aplicadoOrigen = roundMoney(Math.min(montoInicial, saldoOrigen));

      setFolio(folioDoc);
      setContactoNombre(nombre);
      setContactoId(contactoDoc);
      setOrigenId(Number(documentoId));
      setOrigenSaldo(saldoOrigen);
      setMoneda(monedaDoc);
      setTipoCambio(Number(documento.tipo_cambio ?? 1) || 1);
      setFechaDocumento(toCivilDate());
      setMonto(montoInicial);
      setCuentas(cuentasData ?? []);
      setFilas([origenFila, ...otras]);
      setAplicaciones({ [origenFila.id]: aplicadoOrigen });
      distributionIsManualRef.current = false;
      setDistributionIsManual(false);
      setCuentaFinancieraId(null);
      setFormaPago('');
      setReferencia('');
      setObservaciones('');
    } catch (err: any) {
      setError(err?.message || 'No se pudo cargar la liquidación.');
      setFilas([]);
      setAplicaciones({});
      distributionIsManualRef.current = false;
      setDistributionIsManual(false);
    } finally {
      setLoading(false);
    }
  }, [config, contactoIdParam, contactoNombreInicial, documentoId, monedaInicial, saldoInicial, tipoDocumento]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalAplicado = useMemo(
    () => roundMoney(Object.values(aplicaciones).reduce((acc, value) => acc + (Number(value) || 0), 0)),
    [aplicaciones]
  );

  const exceso = useMemo(() => roundMoney(Math.max(0, totalAplicado - monto)), [monto, totalAplicado]);
  const saldoPorAplicar = useMemo(() => roundMoney(Math.max(0, monto - totalAplicado)), [monto, totalAplicado]);
  const aplicadoOrigen = roundMoney(Number(aplicaciones[origenId] ?? 0));
  const saldoRestanteOrigen = roundMoney(Math.max(0, origenSaldo - aplicadoOrigen));
  const tieneExceso = exceso > 0.009;

  const setAplicacionFila = useCallback((filaId: number, _saldoFila: number, raw: string | number | null | undefined) => {
    const parsed = parseMoneyInput(raw);
    marcarDistribucionManual();
    setAplicaciones((prev) => ({ ...prev, [filaId]: parsed }));
  }, [marcarDistribucionManual]);

  const setMontoLiquidacion = useCallback((value: number) => {
    const nextMonto = roundMoney(Math.max(0, value));
    const nextAplicacion = roundMoney(Math.min(nextMonto, origenSaldo));
    setMonto(nextMonto);
    if (!distributionIsManualRef.current) {
      setAplicaciones((prev) => ({
        ...prev,
        [origenId]: nextAplicacion,
      }));
    }
  }, [origenId, origenSaldo]);

  const guardar = useCallback(async () => {
    if (!tipoDocumento || !config) return null;
    if (!cuentaFinancieraId) {
      setError(`Selecciona la cuenta, caja o banco.`);
      return null;
    }
    if (!(monto > 0)) {
      setError(`El ${config.textos.monto.toLowerCase()} debe ser mayor a 0.`);
      return null;
    }
    if (tieneExceso) {
      setError(config.textos.exceso(formatter.format(exceso)));
      return null;
    }

    const aplicacionesDocumento = filas
      .map((fila) => {
        const importe = roundMoney(Number(aplicaciones[fila.id] ?? 0));
        if (!(importe > 0)) return null;
        return {
          documento_destino_id: fila.id,
          monto: importe,
          monto_moneda_documento: importe,
          fecha_aplicacion: fechaDocumento,
        };
      })
      .filter(Boolean) as NonNullable<CotizacionCrearPayload['aplicaciones_documento']>;

    const payload: CotizacionCrearPayload & { referencia?: string | null } = {
      tipo_documento: config.tipoMovimiento,
      contacto_principal_id: contactoId,
      fecha_documento: fechaDocumento,
      moneda,
      tipo_cambio: moneda === 'MXN' ? 1 : (tipoCambio > 0 ? tipoCambio : 1),
      cuenta_financiera_id: cuentaFinancieraId,
      referencia: referencia.trim() || null,
      observaciones: observaciones.trim() || null,
      subtotal: monto,
      descuento_global: 0,
      descuento: 0,
      iva: 0,
      total: monto,
      forma_pago: formaPago.trim() || null,
      metodo_pago: null,
      tratamiento_impuestos: 'sin_iva',
      empresa_id: empresaId ?? undefined,
      usuario_creacion_id: usuarioId ?? null,
      aplicaciones_documento: aplicacionesDocumento,
    };

    setSaving(true);
    setError(null);
    try {
      const created = await createDocumento(config.tipoMovimiento, payload);
      return Number((created as { id?: number })?.id ?? 0) || null;
    } catch (err: any) {
      setError(err?.message || 'No se pudo guardar el movimiento.');
      return null;
    } finally {
      setSaving(false);
    }
  }, [
    aplicaciones,
    config,
    contactoId,
    cuentaFinancieraId,
    exceso,
    fechaDocumento,
    filas,
    formaPago,
    formatter,
    moneda,
    monto,
    observaciones,
    referencia,
    tieneExceso,
    tipoCambio,
    tipoDocumento,
    empresaId,
    usuarioId,
  ]);

  return {
    config,
    loading,
    saving,
    error,
    setError,
    folio,
    contactoNombre,
    contactoId,
    origenId,
    origenSaldo,
    moneda,
    tipoCambio,
    setTipoCambio,
    fechaDocumento,
    setFechaDocumento,
    monto,
    setMonto: setMontoLiquidacion,
    cuentaFinancieraId,
    setCuentaFinancieraId,
    formaPago,
    setFormaPago,
    referencia,
    setReferencia,
    observaciones,
    setObservaciones,
    cuentas,
    filas,
    aplicaciones,
    setAplicacionFila,
    totalAplicado,
    exceso,
    saldoPorAplicar,
    aplicadoOrigen,
    saldoRestanteOrigen,
    tieneExceso,
    distributionIsManual,
    formatter,
    guardar,
    recargar: load,
  };
}

function mapEstadoCuentaToFila(item: EstadoCuentaItem, esOrigen: boolean): LiquidacionFila {
  return {
    id: Number(item.id),
    folio: formatearFolioDocumento(item.serie || '', item.numero || 0) || `#${item.id}`,
    fecha: String(item.fecha ?? '').slice(0, 10),
    saldo: roundMoney(Number(item.saldo ?? 0)),
    esOrigen,
    moneda: String(item.moneda ?? 'MXN').toUpperCase(),
  };
}

export type UseLiquidacionDocumento = ReturnType<typeof useLiquidacionDocumento>;
export type { LiquidacionConfig };
