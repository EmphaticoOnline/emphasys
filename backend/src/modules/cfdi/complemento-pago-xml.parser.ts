import { XMLParser } from 'fast-xml-parser';

export type ComplementoPagoDocumentoRelacionado = {
  uuid: string;
  serie?: string;
  folio?: string;
  moneda: string;
  parcialidad: string;
  saldoAnterior: number;
  importePagado: number;
  saldoInsoluto: number;
  objetoImpuesto?: string;
};

export type ComplementoPagoPago = {
  fechaPago: string;
  formaPago: string;
  moneda: string;
  tipoCambio?: number;
  monto: number;
  numeroOperacion?: string;
  rfcBancoOrdenante?: string;
  bancoOrdenante?: string;
  cuentaOrdenante?: string;
  rfcBancoBeneficiario?: string;
  cuentaBeneficiaria?: string;
  documentos: ComplementoPagoDocumentoRelacionado[];
};

export type ComplementoPagoXmlData = {
  serie?: string;
  folio?: string;
  fechaEmision: string;
  lugarExpedicion: string;
  noCertificado?: string;
  selloCfdi?: string;
  emisor: { rfc: string; nombre: string; regimenFiscal?: string };
  receptor: {
    rfc: string;
    nombre: string;
    regimenFiscal?: string;
    domicilioFiscal?: string;
    usoCfdi?: string;
  };
  versionPagos: string;
  pagos: ComplementoPagoPago[];
  montoTotalPagos: number;
  uuid: string;
  fechaTimbrado: string;
  noCertificadoSat?: string;
  rfcPac?: string;
  selloSat?: string;
};

export const COMPLEMENTO_PAGO_PDF_ERROR =
  'No fue posible generar la representación impresa del complemento de pago porque el XML fiscal está incompleto.';

const array = <T>(value: T | T[] | undefined | null): T[] =>
  value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];

const text = (value: unknown): string => String(value ?? '').trim();
const amount = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

export function parseComplementoPagoXml(xml: string): ComplementoPagoXmlData {
  try {
    const parsed = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      removeNSPrefix: true,
      trimValues: true,
    }).parse(xml);
    const comprobante = parsed?.Comprobante;
    const pagosNode = comprobante?.Complemento?.Pagos;
    const timbre = comprobante?.Complemento?.TimbreFiscalDigital;
    const pagos = array<any>(pagosNode?.Pago).map((pago) => ({
      fechaPago: text(pago.FechaPago),
      formaPago: text(pago.FormaDePagoP),
      moneda: text(pago.MonedaP),
      tipoCambio: text(pago.TipoCambioP) ? amount(pago.TipoCambioP) : undefined,
      monto: amount(pago.Monto),
      numeroOperacion: text(pago.NumOperacion) || undefined,
      rfcBancoOrdenante: text(pago.RfcEmisorCtaOrd) || undefined,
      bancoOrdenante: text(pago.NomBancoOrdExt) || undefined,
      cuentaOrdenante: text(pago.CtaOrdenante) || undefined,
      rfcBancoBeneficiario: text(pago.RfcEmisorCtaBen) || undefined,
      cuentaBeneficiaria: text(pago.CtaBeneficiario) || undefined,
      documentos: array<any>(pago.DoctoRelacionado).map((documento) => ({
        uuid: text(documento.IdDocumento),
        serie: text(documento.Serie) || undefined,
        folio: text(documento.Folio) || undefined,
        moneda: text(documento.MonedaDR),
        parcialidad: text(documento.NumParcialidad),
        saldoAnterior: amount(documento.ImpSaldoAnt),
        importePagado: amount(documento.ImpPagado),
        saldoInsoluto: amount(documento.ImpSaldoInsoluto),
        objetoImpuesto: text(documento.ObjetoImpDR) || undefined,
      })),
    }));

    const result: ComplementoPagoXmlData = {
      serie: text(comprobante?.Serie) || undefined,
      folio: text(comprobante?.Folio) || undefined,
      fechaEmision: text(comprobante?.Fecha),
      lugarExpedicion: text(comprobante?.LugarExpedicion),
      noCertificado: text(comprobante?.NoCertificado) || undefined,
      selloCfdi: text(comprobante?.Sello) || undefined,
      emisor: {
        rfc: text(comprobante?.Emisor?.Rfc),
        nombre: text(comprobante?.Emisor?.Nombre),
        regimenFiscal: text(comprobante?.Emisor?.RegimenFiscal) || undefined,
      },
      receptor: {
        rfc: text(comprobante?.Receptor?.Rfc),
        nombre: text(comprobante?.Receptor?.Nombre),
        regimenFiscal: text(comprobante?.Receptor?.RegimenFiscalReceptor) || undefined,
        domicilioFiscal: text(comprobante?.Receptor?.DomicilioFiscalReceptor) || undefined,
        usoCfdi: text(comprobante?.Receptor?.UsoCFDI) || undefined,
      },
      versionPagos: text(pagosNode?.Version),
      pagos,
      montoTotalPagos: amount(pagosNode?.Totales?.MontoTotalPagos),
      uuid: text(timbre?.UUID),
      fechaTimbrado: text(timbre?.FechaTimbrado),
      noCertificadoSat: text(timbre?.NoCertificadoSAT) || undefined,
      rfcPac: text(timbre?.RfcProvCertif) || undefined,
      selloSat: text(timbre?.SelloSAT) || undefined,
    };

    const documentos = pagos.flatMap((pago) => pago.documentos);
    const importesValidos =
      pagos.every((pago) => Number.isFinite(pago.monto) && pago.monto > 0) &&
      documentos.every(
        (documento) =>
          documento.uuid &&
          [documento.saldoAnterior, documento.importePagado, documento.saldoInsoluto]
            .every(Number.isFinite)
      );
    if (
      text(comprobante?.TipoDeComprobante).toUpperCase() !== 'P' ||
      result.versionPagos !== '2.0' ||
      !result.uuid ||
      !result.emisor.rfc ||
      !result.receptor.rfc ||
      pagos.length === 0 ||
      documentos.length === 0 ||
      !importesValidos
    ) {
      throw new Error(COMPLEMENTO_PAGO_PDF_ERROR);
    }
    if (!Number.isFinite(result.montoTotalPagos)) {
      result.montoTotalPagos = pagos.reduce((sum, pago) => sum + pago.monto, 0);
    }
    return result;
  } catch (error) {
    if (error instanceof Error && error.message === COMPLEMENTO_PAGO_PDF_ERROR) throw error;
    throw new Error(COMPLEMENTO_PAGO_PDF_ERROR);
  }
}
