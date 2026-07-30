import pool from '../config/database';
import { parseComplementoPagoXml, type ComplementoPagoXmlData } from '../modules/cfdi/complemento-pago-xml.parser';
import { generarComplementoPagoPdfDesdeXml } from '../modules/documentos/complemento-pago.pdf';
import { generarDocumentoPDF, obtenerLogoEmpresaPath } from '../modules/documentos/documentos.pdf';
import { obtenerDocumentoRepository } from '../modules/documentos/documentos.repository';
import { getConfiguracionEmailPrivada } from '../modules/configuracion/email/email.service';
import { formatearFolioDocumento } from '../utils/documentos';
import { EmailService, type EmailAttachment } from './email.service';

export type CfdiEmailTipo = 'factura' | 'complemento_pago';

export class CfdiEmailError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    options?: { cause?: unknown }
  ) {
    super(message);
    this.name = 'CfdiEmailError';
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

type CfdiDocumentoRow = {
  id: number;
  empresa_id: number;
  tipo_documento: string;
  estatus_documento: string | null;
  serie: string | null;
  numero: number | null;
  contacto_id: number | null;
  contacto_email: string | null;
  uuid: string | null;
  xml_timbrado: string | null;
  fecha_timbrado: Date | string | null;
  estado_sat: string | null;
  cadena_original: string | null;
  rfc_proveedor_certificacion: string | null;
  no_certificado_sat: string | null;
  sello_cfdi: string | null;
  sello_sat: string | null;
  rfc_emisor: string | null;
  rfc_receptor: string | null;
  total_cfdi: string | number | null;
};

export type CfdiEmailPrepared = {
  subject: string;
  text: string;
  html?: string;
  attachments: EmailAttachment[];
};

export type CfdiEmailInput = {
  tipo: CfdiEmailTipo;
  documentoId: number;
  empresaId: number;
  usuarioId?: number | null;
  emailDestino?: string;
};

type CfdiEmailDependencies = {
  send?: (input: {
    to: string;
    from?: string;
    subject: string;
    text: string;
    html?: string;
    attachments: EmailAttachment[];
  }) => Promise<unknown>;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validarEmailDestino(value: unknown): string {
  const email = String(value ?? '').trim();
  if (!email) {
    throw new CfdiEmailError('El cliente no tiene un correo registrado.', 400, 'EMAIL_REQUIRED');
  }
  if (email.length > 254 || !emailPattern.test(email)) {
    throw new CfdiEmailError('El correo destinatario no es válido.', 400, 'EMAIL_INVALID');
  }
  return email;
}

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const folioDocumento = (documento: Pick<CfdiDocumentoRow, 'serie' | 'numero' | 'id'>): string => {
  const numero = Number(documento.numero);
  return Number.isFinite(numero)
    ? formatearFolioDocumento(documento.serie ?? '', numero)
    : String(documento.id);
};

const money = (value: number, moneda: string): string => {
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: moneda || 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `$${Number(value).toFixed(2)}`;
  }
};

const folioRelacionado = (documento: ComplementoPagoXmlData['pagos'][number]['documentos'][number]): string =>
  [documento.serie, documento.folio].filter(Boolean).join('-') || documento.uuid;

export function construirContenidoComplementoPago(
  data: ComplementoPagoXmlData,
  folio: string
): Pick<CfdiEmailPrepared, 'subject' | 'text' | 'html'> {
  const nombreEmisor = data.emisor.nombre.trim();
  const nombreReceptor = data.receptor.nombre.trim();
  const subject = `Complemento de pago ${folio}${nombreEmisor ? ` – ${nombreEmisor}` : ''}`;
  const saludo = nombreReceptor ? `Estimado(a) ${nombreReceptor}:` : 'Estimado(a):';
  const documentos = data.pagos.flatMap((pago) =>
    pago.documentos.map((documento) => ({
      folio: folioRelacionado(documento),
      importe: documento.importePagado,
      moneda: documento.moneda || pago.moneda || 'MXN',
    }))
  );
  const monedaPago = data.pagos[0]?.moneda || documentos[0]?.moneda || 'MXN';
  const monto = `${money(data.montoTotalPagos, monedaPago)} ${monedaPago}`;
  const relacionadosTexto = documentos
    .map((documento) => `- Factura ${documento.folio} — importe aplicado: ${money(documento.importe, documento.moneda)} ${documento.moneda}`)
    .join('\n');
  const firma = nombreEmisor || 'El emisor';

  const text = [
    saludo,
    '',
    `Adjuntamos el Complemento de Pago ${folio} correspondiente al pago recibido por ${monto}.`,
    '',
    'Documentos relacionados:',
    relacionadosTexto,
    '',
    'Se incluyen:',
    '- la representación impresa en PDF;',
    '- el archivo XML fiscal.',
    '',
    'Agradecemos su pago.',
    '',
    'Atentamente,',
    firma,
  ].join('\n');

  const relacionadosHtml = documentos
    .map((documento) =>
      `<li>Factura ${escapeHtml(documento.folio)} — importe aplicado: ${escapeHtml(money(documento.importe, documento.moneda))} ${escapeHtml(documento.moneda)}</li>`
    )
    .join('');
  const html = [
    `<p>${escapeHtml(saludo)}</p>`,
    `<p>Adjuntamos el <strong>Complemento de Pago ${escapeHtml(folio)}</strong> correspondiente al pago recibido por <strong>${escapeHtml(monto)}</strong>.</p>`,
    '<p>Documentos relacionados:</p>',
    `<ul>${relacionadosHtml}</ul>`,
    '<p>Se incluyen:</p>',
    '<ul><li>la representación impresa en PDF;</li><li>el archivo XML fiscal.</li></ul>',
    '<p>Agradecemos su pago.</p>',
    `<p>Atentamente,<br>${escapeHtml(firma)}</p>`,
  ].join('');

  return { subject, text, html };
}

export function validarXmlComplementoPago(xml: string, uuidPersistido: string): ComplementoPagoXmlData {
  let parsed: ComplementoPagoXmlData;
  try {
    parsed = parseComplementoPagoXml(xml);
  } catch (error) {
    throw new CfdiEmailError('El XML no corresponde a un CFDI tipo P con Pagos 2.0.', 422, 'INVALID_PAYMENT_XML', { cause: error });
  }
  if (parsed.uuid.toLowerCase() !== uuidPersistido.toLowerCase()) {
    throw new CfdiEmailError('El UUID del XML no coincide con el UUID registrado.', 422, 'UUID_MISMATCH');
  }
  return parsed;
}

export function prepararComplementoPagoEmail(
  data: ComplementoPagoXmlData,
  folio: string,
  xmlOriginal: string,
  pdf: Buffer
): CfdiEmailPrepared {
  return {
    ...construirContenidoComplementoPago(data, folio),
    attachments: [
      { filename: `Complemento-Pago-${folio}.pdf`, content: pdf, contentType: 'application/pdf' },
      { filename: `Complemento-Pago-${folio}.xml`, content: xmlOriginal, contentType: 'application/xml' },
    ],
  };
}

function mapearErrorSmtp(error: any): CfdiEmailError {
  if (error instanceof CfdiEmailError) return error;
  const code = String(error?.code ?? '').toUpperCase();
  const message = String(error?.message ?? '').toLowerCase();
  if (code.includes('TIMEOUT') || code === 'ETIMEDOUT' || message.includes('timeout')) {
    return new CfdiEmailError('El servidor de correo no respondió a tiempo.', 504, 'SMTP_TIMEOUT', { cause: error });
  }
  return new CfdiEmailError('El servidor de correo rechazó el envío.', 502, 'SMTP_REJECTED', { cause: error });
}

export class CfdiEmailService {
  static async enviar(input: CfdiEmailInput, dependencies: CfdiEmailDependencies = {}): Promise<void> {
    const startedAt = Date.now();
    const documento = await this.obtenerDocumento(input.documentoId, input.empresaId);
    const email = validarEmailDestino(input.emailDestino || documento.contacto_email);
    const prepared = input.tipo === 'factura'
      ? await this.prepararFactura(documento)
      : await this.prepararComplemento(documento);
    const smtp = await getConfiguracionEmailPrivada(input.empresaId, input.usuarioId ?? null);
    if (!smtp) {
      throw new CfdiEmailError('No hay configuración SMTP activa para esta empresa o usuario.', 500, 'SMTP_NOT_CONFIGURED');
    }
    const fromEmail = smtp.email_remitente || smtp.smtp_user || undefined;
    const from = fromEmail && smtp.nombre_remitente ? `${smtp.nombre_remitente} <${fromEmail}>` : fromEmail;

    try {
      const send = dependencies.send ?? ((message) => EmailService.sendMailWithConfig(smtp, message));
      await send({ to: email, from, ...prepared });
      console.info('[CFDI Email] envio completado', {
        empresaId: input.empresaId,
        documentoId: input.documentoId,
        tipo: input.tipo,
        resultado: 'ok',
        duracionMs: Date.now() - startedAt,
      });
    } catch (error) {
      const mapped = mapearErrorSmtp(error);
      console.warn('[CFDI Email] envio fallido', {
        empresaId: input.empresaId,
        documentoId: input.documentoId,
        tipo: input.tipo,
        resultado: 'error',
        codigo: mapped.code,
        duracionMs: Date.now() - startedAt,
      });
      throw mapped;
    }
  }

  private static async obtenerDocumento(documentoId: number, empresaId: number): Promise<CfdiDocumentoRow> {
    const { rows } = await pool.query<CfdiDocumentoRow>(
      `SELECT d.id, d.empresa_id, d.tipo_documento, d.estatus_documento, d.serie, d.numero,
              d.contacto_principal_id AS contacto_id, c.email AS contacto_email,
              dc.uuid, dc.xml_timbrado, dc.fecha_timbrado, dc.estado_sat, dc.cadena_original,
              dc.rfc_proveedor_certificacion, dc.no_certificado_sat, dc.sello_cfdi, dc.sello_sat,
              dc.rfc_emisor, dc.rfc_receptor, dc.total AS total_cfdi
         FROM documentos d
         LEFT JOIN contactos c ON c.id = d.contacto_principal_id
         LEFT JOIN documentos_cfdi dc ON dc.documento_id = d.id
        WHERE d.id = $1 AND d.empresa_id = $2
        LIMIT 1`,
      [documentoId, empresaId]
    );
    if (!rows[0]) {
      throw new CfdiEmailError('Documento no encontrado.', 404, 'DOCUMENT_NOT_FOUND');
    }
    return rows[0];
  }

  private static assertTimbrado(documento: CfdiDocumentoRow, label: string): void {
    if (String(documento.estatus_documento ?? '').trim().toLowerCase() !== 'timbrado') {
      throw new CfdiEmailError(`${label} no está timbrad${label === 'La factura' ? 'a' : 'o'}.`, 409, 'DOCUMENT_NOT_STAMPED');
    }
  }

  private static assertCfdi(documento: CfdiDocumentoRow, label: string): asserts documento is CfdiDocumentoRow & { uuid: string; xml_timbrado: string } {
    if (!documento.uuid) {
      throw new CfdiEmailError(`No se encontró el CFDI de ${label}.`, 404, 'CFDI_NOT_FOUND');
    }
    if (!documento.xml_timbrado) {
      const message = label === 'la factura'
        ? 'No se encontró el XML timbrado de la factura.'
        : 'El complemento de pago no tiene XML timbrado.';
      throw new CfdiEmailError(message, 404, 'XML_NOT_FOUND');
    }
  }

  private static async prepararFactura(documento: CfdiDocumentoRow): Promise<CfdiEmailPrepared> {
    if (documento.tipo_documento.toLowerCase() !== 'factura') {
      throw new CfdiEmailError('El documento no corresponde a una factura.', 400, 'WRONG_DOCUMENT_TYPE');
    }
    this.assertTimbrado(documento, 'La factura');
    this.assertCfdi(documento, 'la factura');
    const data = await obtenerDocumentoRepository(documento.id, documento.empresa_id, 'factura');
    if (!data) {
      throw new CfdiEmailError('Factura no encontrada para generar PDF.', 404, 'DOCUMENT_NOT_FOUND');
    }
    (data.documento as any).timbre = {
      uuid: documento.uuid,
      fecha_timbrado: documento.fecha_timbrado instanceof Date
        ? documento.fecha_timbrado.toISOString()
        : documento.fecha_timbrado,
      rfc_proveedor_certificacion: documento.rfc_proveedor_certificacion,
      no_certificado_sat: documento.no_certificado_sat,
      sello_cfdi: documento.sello_cfdi,
      sello_sat: documento.sello_sat,
      cadena_original: documento.cadena_original,
      rfc_emisor: documento.rfc_emisor,
      rfc_receptor: documento.rfc_receptor,
      total: documento.total_cfdi,
    };
    (data.documento as any).estatus_documento = 'Timbrado';
    let pdf: Buffer;
    try {
      pdf = await generarDocumentoPDF(data, documento.empresa_id);
    } catch (error) {
      throw new CfdiEmailError('No fue posible generar el PDF de la factura.', 422, 'PDF_GENERATION_FAILED', { cause: error });
    }
    const folio = folioDocumento(documento);
    return {
      subject: `Factura ${folio}`,
      text: 'Se adjuntan el PDF y el XML de su factura.',
      attachments: [
        { filename: `${folio}.pdf`, content: pdf, contentType: 'application/pdf' },
        { filename: `${folio}.xml`, content: documento.xml_timbrado, contentType: 'application/xml' },
      ],
    };
  }

  private static async prepararComplemento(documento: CfdiDocumentoRow): Promise<CfdiEmailPrepared> {
    if (documento.tipo_documento.toLowerCase() !== 'pago_cliente') {
      throw new CfdiEmailError('El documento no corresponde a un Complemento de Pago.', 400, 'WRONG_DOCUMENT_TYPE');
    }
    this.assertTimbrado(documento, 'El complemento de pago');
    this.assertCfdi(documento, 'el complemento de pago');
    const parsed = validarXmlComplementoPago(documento.xml_timbrado, documento.uuid);
    let pdf: Buffer;
    try {
      pdf = await generarComplementoPagoPdfDesdeXml(documento.xml_timbrado, {
        estadoSat: documento.estado_sat,
        cadenaOriginal: documento.cadena_original,
        logoPath: await obtenerLogoEmpresaPath(documento.empresa_id),
      });
    } catch (error) {
      throw new CfdiEmailError('No fue posible generar el PDF del complemento.', 422, 'PDF_GENERATION_FAILED', { cause: error });
    }
    const folio = folioDocumento(documento);
    return prepararComplementoPagoEmail(parsed, folio, documento.xml_timbrado, pdf);
  }
}
