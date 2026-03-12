import { EmailService } from './email.service';
import pool from '../config/database';
import { obtenerDocumentoRepository } from '../modules/documentos/documentos.repository';
import { generarDocumentoPDF } from '../modules/documentos/documentos.pdf';
import { formatearFolioDocumento } from '../utils/documentos';

// Servicio para enviar facturas por correo con PDF y XML adjuntos
export class FacturaEmailService {
  /**
   * Envía una factura por correo. Usa emailDestino si se proporciona; de lo contrario, toma el email del contacto.
   */
  public static async enviarFactura(documentoId: number, emailDestino?: string): Promise<void> {
    // 1) Obtener datos mínimos de la factura
    const documento = await FacturaEmailService.obtenerFactura(documentoId);

    // 2) Obtener email del contacto si no se proporcionó
    const email = emailDestino?.trim() || (await FacturaEmailService.obtenerEmailContacto(documento.contacto_id));
    if (!email) {
      throw new Error('El contacto no tiene correo registrado');
    }

    // 3) Obtener XML timbrado
    const xmlTimbrado = await FacturaEmailService.obtenerXmlTimbrado(documentoId);

    // 4) Generar PDF del documento
    const pdfBuffer = await FacturaEmailService.generarPdf(documentoId, documento.empresa_id);

    // 5) Preparar adjuntos y asunto
    const nombreBase = FacturaEmailService.formatearNombre(documento.serie, documento.numero, documentoId);
    const attachments = [
      {
        filename: `${nombreBase}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
      {
        filename: `${nombreBase}.xml`,
        content: xmlTimbrado,
        contentType: 'application/xml',
      },
    ];

    const subject = `Factura ${nombreBase}`;
    const text = 'Se adjuntan el PDF y el XML de su factura.';

    // 6) Enviar correo
    await EmailService.sendMail({
      to: email,
      subject,
      text,
      attachments,
    });
  }

  // Lee factura mínima para armar nombres y relaciones
  private static async obtenerFactura(documentoId: number) {
    const query = `
      SELECT id, empresa_id, tipo_documento, serie, numero, contacto_principal_id AS contacto_id
      FROM documentos
      WHERE id = $1 AND LOWER(tipo_documento) = 'factura'
      LIMIT 1
    `;
    const { rows } = await pool.query(query, [documentoId]);
    const row = rows[0];
    if (!row) {
      throw new Error('Factura no encontrada');
    }
    return row as { id: number; empresa_id: number; tipo_documento: string; serie: string | null; numero: number | null; contacto_id: number | null };
  }

  // Obtiene email del contacto
  private static async obtenerEmailContacto(contactoId: number | null): Promise<string> {
    if (!contactoId) {
      throw new Error('La factura no tiene contacto asignado');
    }
    const { rows } = await pool.query('SELECT email FROM contactos WHERE id = $1 LIMIT 1', [contactoId]);
    const email = rows[0]?.email as string | undefined;
    if (!email) {
      throw new Error('El contacto no tiene correo registrado');
    }
    return email;
  }

  // Obtiene XML timbrado
  private static async obtenerXmlTimbrado(documentoId: number): Promise<string> {
    const { rows } = await pool.query(
      'SELECT xml_timbrado FROM documentos_cfdi WHERE documento_id = $1 LIMIT 1',
      [documentoId]
    );
    const xml = rows[0]?.xml_timbrado as string | undefined;
    if (!xml) {
      throw new Error('No se encontró el XML timbrado de la factura');
    }
    return xml;
  }

  // Genera PDF utilizando el generador existente
  private static async generarPdf(documentoId: number, empresaId: number): Promise<Buffer> {
    const data = await obtenerDocumentoRepository(documentoId, empresaId, 'factura');
    if (!data) {
      throw new Error('Factura no encontrada para generar PDF');
    }

    // Adjuntar timbre CFDI al documento (mismo patrón que en el controlador de PDF)
    try {
      const { rows } = await pool.query(
        `SELECT uuid, fecha_timbrado, rfc_proveedor_certificacion, no_certificado_sat, sello_cfdi, sello_sat, cadena_original, rfc_emisor, rfc_receptor, total
           FROM documentos_cfdi
          WHERE documento_id = $1
          LIMIT 1`,
        [documentoId]
      );

      const timbre = rows[0];
      if (timbre) {
        (data.documento as any).timbre = {
          uuid: timbre.uuid,
          fecha_timbrado: timbre.fecha_timbrado?.toISOString?.() ?? timbre.fecha_timbrado,
          rfc_proveedor_certificacion: timbre.rfc_proveedor_certificacion,
          no_certificado_sat: timbre.no_certificado_sat,
          sello_cfdi: timbre.sello_cfdi,
          sello_sat: timbre.sello_sat,
          cadena_original: timbre.cadena_original,
          rfc_emisor: timbre.rfc_emisor,
          rfc_receptor: timbre.rfc_receptor,
          total: timbre.total,
        };
        (data.documento as any).estatus_documento = 'Timbrado';
      }
    } catch (err) {
      // No bloquear el envío si falla la carga del timbre, pero logueamos para seguimiento
      console.error('No se pudo adjuntar timbre CFDI al PDF', err);
    }

    return generarDocumentoPDF(data, data.documento?.empresa_id ?? undefined);
  }

  // Normaliza nombre base de archivos usando el formateador de folio del sistema
  private static formatearNombre(serie: string | null, numero: number | null, documentoId: number): string {
    const numeroParaFolio = numero ?? documentoId;
    return formatearFolioDocumento(serie ?? '', Number(numeroParaFolio));
  }
}
