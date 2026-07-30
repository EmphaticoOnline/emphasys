import type { ImpuestoDR, AplicacionComplemento, PagoComplementData } from './cfdi.types';

export type { ImpuestoDR, AplicacionComplemento, PagoComplementData };

// ---------------------------------------------------------------------------

const fmt2 = (n: number): string => n.toFixed(2);

const mapImpuestoNombre = (code: string): string => {
  const v = (code || '').toUpperCase().trim();
  if (v === '002' || v === 'IVA' || v.startsWith('IVA')) return 'IVA';
  if (v === '001' || v === 'ISR' || v.startsWith('ISR')) return 'ISR';
  if (v === '003' || v === 'IEPS' || v.startsWith('IEPS')) return 'IEPS';
  return code;
};

// Normaliza tasa a decimal (0.16). La BD puede guardar 16 o 0.16.
const normalizeRate = (tasa: number): number => (tasa > 1 ? tasa / 100 : tasa);

// SAT/Facturama espera FechaPago en hora local del emisor (México) sin offset,
// en formato YYYY-MM-DDTHH:MM:SS. Si enviamos UTC sin Z, Facturama lo interpreta
// como hora México y puede aparecer como fecha futura. Convertimos explícitamente
// a hora México antes de formatear.
const formatFechaPago = (fecha: string | Date): string => {
  const d = fecha instanceof Date ? fecha : new Date(String(fecha ?? ''));
  const effective = Number.isFinite(d.getTime()) && d > new Date() ? new Date() : d;
  // sv-SE produce "YYYY-MM-DD HH:MM:SS" en la zona horaria indicada
  return effective
    .toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' })
    .replace(' ', 'T')
    .slice(0, 19);
};

const isRfcGenerico = (rfc: string): boolean => {
  const u = (rfc || '').toUpperCase();
  return u === 'XAXX010101000' || u === 'XEXX010101000';
};

export type PagoComplementPayload = {
  NameId: string;
  Serie?: string;
  Folio: string;
  CfdiType: 'P';
  ExpeditionPlace: string;
  PaymentForm: null;
  PaymentMethod: null;
  Issuer: {
    FiscalRegime: string;
    Rfc: string;
    Name: string;
  };
  Receiver: {
    Rfc: string;
    Name: string;
    CfdiUse: 'CP01';
    FiscalRegime: string;
    TaxZipCode: string;
  };
  Complemento: {
    Payments: Array<{
      Date: string;
      PaymentForm: string;
      Currency: string;
      Amount: string;
      RelatedDocuments: Array<Record<string, unknown>>;
    }>;
  };
};

const PAYMENT_FOLIO_ERROR =
  'El complemento de pago no tiene un folio válido y no puede enviarse a Facturama.';

export function assertPagoComplementPayload(
  value: unknown
): asserts value is PagoComplementPayload {
  const payload = value as Partial<PagoComplementPayload> | null;
  const folio = typeof payload?.Folio === 'string' ? payload.Folio.trim() : '';
  if (!folio || folio.length > 40) {
    throw new Error(PAYMENT_FOLIO_ERROR);
  }

  const payments = payload?.Complemento?.Payments;
  const hasRelatedDocument =
    Array.isArray(payments) &&
    payments.some(
      (payment) =>
        Array.isArray(payment?.RelatedDocuments) && payment.RelatedDocuments.length > 0
    );

  if (
    payload?.CfdiType !== 'P' ||
    !String(payload?.Issuer?.Rfc || '').trim() ||
    !String(payload?.Receiver?.Rfc || '').trim() ||
    !String(payload?.ExpeditionPlace || '').trim() ||
    !payload?.Complemento ||
    !Array.isArray(payments) ||
    payments.length === 0 ||
    !hasRelatedDocument
  ) {
    throw new Error(
      'El complemento de pago contiene datos fiscales incompletos y no puede enviarse a Facturama.'
    );
  }
}

export function buildPagoComplementPayload(data: PagoComplementData): PagoComplementPayload {
  const { empresa, receptor, pago, aplicaciones } = data;
  const folio = String(pago.folio ?? '').trim();
  const serie = String(pago.serie ?? '').trim();

  const doctoRelacionados = aplicaciones.map((ap) => {
    const impPagado = Number(ap.monto_moneda_documento);
    const totalFactura = Number(ap.total_factura);
    const proporcion = totalFactura > 0 ? impPagado / totalFactura : 0;

    // Agrupar impuestos por (nombre, tipo, tasa) y sumar base+monto de partidas
    const grouped = new Map<
      string,
      { nombre: string; tipo: string; tasa: number; base: number; monto: number }
    >();
    for (const imp of ap.impuestos) {
      const rate = normalizeRate(Number(imp.tasa));
      const key = `${mapImpuestoNombre(imp.impuesto)}|${imp.tipo}|${rate}`;
      const existing = grouped.get(key) ?? {
        nombre: imp.impuesto,
        tipo: imp.tipo,
        tasa: rate,
        base: 0,
        monto: 0,
      };
      existing.base += Number(imp.base);
      existing.monto += Number(imp.monto);
      grouped.set(key, existing);
    }

    // Impuestos proporcionales — estructura Facturama JSON (no nombres XML SAT)
    const taxes = [...grouped.values()].map((imp) => ({
      Name: mapImpuestoNombre(imp.nombre),
      Base: fmt2(imp.base * proporcion),
      Rate: normalizeRate(imp.tasa),
      Total: fmt2(imp.monto * proporcion),
      IsRetention: imp.tipo === 'retencion',
    }));

    const hasTaxes = taxes.length > 0;

    const docto: Record<string, unknown> = {
      TaxObject: hasTaxes ? '02' : '01',
      Uuid: ap.uuid_factura,
      ...(ap.serie ? { Serie: ap.serie } : {}),
      ...(ap.folio ? { Folio: ap.folio } : {}),
      Currency: ap.moneda_factura,
      PaymentMethod: ap.payment_method,
      PartialityNumber: String(ap.num_parcialidad),
      PreviousBalanceAmount: fmt2(Number(ap.imp_saldo_ant)),
      AmountPaid: fmt2(impPagado),
      ImpSaldoInsoluto: fmt2(Number(ap.imp_saldo_insoluto)),
    };

    // EquivalenceDocRel solo cuando la moneda de la factura difiere del pago
    if (ap.moneda_factura !== pago.moneda) {
      const tipoCambioPago = Number(pago.tipo_cambio) || 1;
      const tipoCambioFactura = Number(ap.tipo_cambio_factura) || 1;
      docto.EquivalenceDocRel = tipoCambioFactura / tipoCambioPago;
    }

    if (hasTaxes) {
      docto.Taxes = taxes;
    }

    return docto;
  });

  const payload: PagoComplementPayload = {
    NameId: '14',
    ...(serie ? { Serie: serie } : {}),
    Folio: folio,
    CfdiType: 'P',
    ExpeditionPlace: empresa.codigo_postal_id,
    PaymentForm: null,
    PaymentMethod: null,
    Issuer: {
      FiscalRegime: empresa.regimen_fiscal,
      Rfc: empresa.rfc,
      Name: empresa.razon_social,
    },
    Receiver: {
      Rfc: receptor.rfc,
      Name: receptor.nombre,
      CfdiUse: 'CP01',
      FiscalRegime: isRfcGenerico(receptor.rfc) ? '616' : receptor.regimen_fiscal,
      // SAT exige que para RFC genérico TaxZipCode == ExpeditionPlace
      TaxZipCode: isRfcGenerico(receptor.rfc) ? empresa.codigo_postal_id : receptor.codigo_postal,
    },
    Complemento: {
      Payments: [
        {
          Date: formatFechaPago(pago.fecha),
          PaymentForm: pago.forma_pago,
          Currency: pago.moneda,
          Amount: fmt2(Number(pago.monto)),
          RelatedDocuments: doctoRelacionados,
        },
      ],
    },
  };

  assertPagoComplementPayload(payload);
  return payload;
}
