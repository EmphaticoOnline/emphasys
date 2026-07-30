import { XMLParser } from 'fast-xml-parser';
import { PagoComplementValidationError } from './pago-complement.errors';

export type FacturaRelacionadaPago = {
  documentoId: number;
  folio: string;
  tipoDocumento: string;
  empresaId: number;
  estatusDocumento: string | null;
  tratamientoImpuestos: string | null;
  uuid: string | null;
  xmlTimbrado: string | null;
  estadoSat: string | null;
  fechaCancelacion: string | Date | null;
  rfcEmpresa: string;
  previousBalance: number;
  amountPaid: number;
  remainingBalance: number;
  partialityNumber: number;
};

export type FacturaRelacionadaPagoValidada = {
  paymentMethod: 'PPD';
  receptor: ReceptorFiscalXml;
};

export type ReceptorFiscalXml = {
  rfc: string;
  nombre: string;
  regimenFiscal: string;
  domicilioFiscal: string;
  usoCfdi: string | null;
};

const moneyEquals = (left: number, right: number): boolean =>
  Math.abs(left - right) <= 0.01;

const normalize = (value: unknown): string =>
  String(value ?? '').trim().toUpperCase();

const normalizeName = (value: unknown): string =>
  normalize(value).replace(/\s+/g, ' ');

const invoiceDetails = (input: FacturaRelacionadaPago): Record<string, unknown> => ({
  documento_id: input.documentoId,
  folio: input.folio,
  uuid: input.uuid || undefined,
});

const invalidApplication = (input: FacturaRelacionadaPago, message: string): never => {
  throw new PagoComplementValidationError(
    'PAYMENT_APPLICATION_INVALID',
    message,
    422,
    invoiceDetails(input)
  );
};

export function validarFacturaRelacionadaPago(
  input: FacturaRelacionadaPago
): FacturaRelacionadaPagoValidada {
  if (normalize(input.tipoDocumento) !== 'FACTURA') {
    return invalidApplication(
      input,
      `La aplicación corresponde a ${input.tipoDocumento || 'un documento no fiscal'} ${input.folio} y no puede incluirse en un complemento de pago.`
    );
  }
  if (normalize(input.tratamientoImpuestos) === 'SIN_IVA') {
    return invalidApplication(
      input,
      `La factura ${input.folio} es una nota de venta y no puede incluirse en un complemento de pago.`
    );
  }
  if (!input.uuid) {
    throw new PagoComplementValidationError(
      'RELATED_INVOICE_WITHOUT_UUID',
      `La factura ${input.folio} no tiene UUID fiscal.`,
      404,
      invoiceDetails(input)
    );
  }
  if (!input.xmlTimbrado) {
    throw new PagoComplementValidationError(
      'RELATED_INVOICE_WITHOUT_XML',
      `La factura ${input.folio} no tiene XML timbrado disponible.`,
      404,
      invoiceDetails(input)
    );
  }
  if (
    normalize(input.estatusDocumento) === 'CANCELADO' ||
    normalize(input.estadoSat) !== 'VIGENTE' ||
    input.fechaCancelacion
  ) {
    throw new PagoComplementValidationError(
      'RELATED_INVOICE_CANCELLED',
      `La factura ${input.folio} está cancelada o su CFDI no está vigente.`,
      409,
      invoiceDetails(input)
    );
  }
  if (input.previousBalance <= 0 || input.amountPaid <= 0) {
    return invalidApplication(input, `La aplicación de la factura ${input.folio} debe tener importes mayores que cero.`);
  }
  if (input.amountPaid - input.previousBalance > 0.01) {
    return invalidApplication(input, `El importe pagado excede el saldo anterior de la factura ${input.folio}.`);
  }
  if (input.remainingBalance < -0.01) {
    return invalidApplication(input, `El saldo insoluto de la factura ${input.folio} no puede ser negativo.`);
  }
  if (!moneyEquals(input.remainingBalance, input.previousBalance - input.amountPaid)) {
    throw new PagoComplementValidationError(
      'PAYMENT_BALANCE_INVALID',
      `Los saldos de la aplicación de la factura ${input.folio} no son coherentes.`,
      422,
      invoiceDetails(input)
    );
  }
  if (!Number.isInteger(input.partialityNumber) || input.partialityNumber <= 0) {
    return invalidApplication(input, `La parcialidad de la factura ${input.folio} no es válida.`);
  }

  let comprobante: any;
  try {
    comprobante = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      removeNSPrefix: true,
      trimValues: true,
    }).parse(input.xmlTimbrado)?.Comprobante;
  } catch {
    throw new PagoComplementValidationError(
      'RELATED_XML_INVALID',
      `El XML timbrado de la factura ${input.folio} no es válido.`,
      422,
      invoiceDetails(input)
    );
  }

  const xmlUuid = comprobante?.Complemento?.TimbreFiscalDigital?.UUID;
  if (normalize(xmlUuid) !== normalize(input.uuid)) {
    throw new PagoComplementValidationError(
      'RELATED_XML_INVALID',
      `El UUID del XML de la factura ${input.folio} no coincide con el registro fiscal.`,
      422,
      invoiceDetails(input)
    );
  }
  if (normalize(comprobante?.Emisor?.Rfc) !== normalize(input.rfcEmpresa)) {
    throw new PagoComplementValidationError(
      'RELATED_XML_INVALID',
      `El RFC emisor de la factura ${input.folio} no corresponde a la empresa activa.`,
      422,
      invoiceDetails(input)
    );
  }

  const receptorNode = comprobante?.Receptor;
  const receptor: ReceptorFiscalXml = {
    rfc: String(receptorNode?.Rfc ?? '').trim().toUpperCase(),
    nombre: String(receptorNode?.Nombre ?? '').trim().replace(/\s+/g, ' '),
    regimenFiscal: String(receptorNode?.RegimenFiscalReceptor ?? '').trim(),
    domicilioFiscal: String(receptorNode?.DomicilioFiscalReceptor ?? '').trim(),
    usoCfdi: String(receptorNode?.UsoCFDI ?? '').trim() || null,
  };
  if (!receptor.rfc || !receptor.nombre || !receptor.regimenFiscal || !receptor.domicilioFiscal) {
    throw new PagoComplementValidationError(
      'RELATED_XML_INVALID',
      `El XML timbrado de la factura ${input.folio} no contiene un Receptor fiscal completo.`,
      422,
      invoiceDetails(input)
    );
  }

  const paymentMethod = normalize(comprobante?.MetodoPago);
  if (paymentMethod !== 'PPD') {
    const shown = paymentMethod || 'vacío';
    throw new PagoComplementValidationError(
      'RELATED_INVOICE_NOT_PPD',
      `La factura ${input.folio} fue emitida como ${shown} y no admite complemento de pago.`,
      422,
      invoiceDetails(input)
    );
  }

  return { paymentMethod: 'PPD', receptor };
}

export function validarReceptorFiscalComun(
  facturas: Array<{ folio: string; receptor: ReceptorFiscalXml }>
): ReceptorFiscalXml {
  const first = facturas[0];
  if (!first) {
    throw new PagoComplementValidationError(
      'PAYMENT_WITHOUT_APPLICATIONS',
      'El pago no tiene facturas aplicadas.',
      409
    );
  }

  const differences = facturas.slice(1).filter(({ receptor }) =>
    normalize(receptor.rfc) !== normalize(first.receptor.rfc) ||
    normalizeName(receptor.nombre) !== normalizeName(first.receptor.nombre) ||
    String(receptor.regimenFiscal).trim() !== String(first.receptor.regimenFiscal).trim() ||
    String(receptor.domicilioFiscal).trim() !== String(first.receptor.domicilioFiscal).trim()
  );
  if (differences.length) {
    throw new PagoComplementValidationError(
      'RELATED_RECEIVER_MISMATCH',
      'Las facturas aplicadas no corresponden al mismo receptor fiscal. Revise las aplicaciones antes de generar el Complemento de Pago.',
      422,
      { folios_con_diferencias: differences.map((item) => item.folio) }
    );
  }
  return first.receptor;
}
