import type { SentMessageInfo } from 'nodemailer';
import pool from '../config/database';
import { getConfiguracionEmailPrivada } from '../modules/configuracion/email/email.service';
import { obtenerPlantillaEmail } from '../modules/configuracion/email/email-plantillas.repository';
import { obtenerDocumentoRepository } from '../modules/documentos/documentos.repository';
import { generarDocumentoPDF } from '../modules/documentos/documentos.pdf';
import { EmailService } from './email.service';
import { formatearFolioDocumento } from '../utils/documentos';
import {
  actualizarConversacionSaliente,
  getOrCreateConversacionContacto,
  registrarMensajeEmailSaliente,
} from '../crm/conversaciones.service';

type EnviarCotizacionEmailInput = {
  documentoId: number;
  empresaId: number;
  usuarioId?: number | null;
  to: string;
  subject: string;
  message: string;
};

type DocumentoCotizacionEmail = {
  id: number;
  empresa_id: number;
  contacto_id: number | null;
  cliente_nombre: string | null;
  vendedor_id: number | null;
  tipo_documento: string;
  serie: string | null;
  numero: number | null;
  estado_seguimiento: string | null;
};

export class CotizacionEmailService {
  public static async enviarCotizacion(input: EnviarCotizacionEmailInput) {
    const to = input.to.trim();
    const subject = input.subject.trim();
    const message = input.message?.trim() || '';

    if (!to) {
      throw new Error('El correo destino es obligatorio');
    }

    const documento = await CotizacionEmailService.obtenerCotizacion(input.documentoId, input.empresaId);
    const pdfBuffer = await CotizacionEmailService.generarPdf(input.documentoId, input.empresaId);
    const smtpConfig = await getConfiguracionEmailPrivada(documento.empresa_id, input.usuarioId ?? null);

    if (!smtpConfig) {
      throw new Error('No hay configuración SMTP activa para esta empresa o usuario');
    }

    const conversacionId = documento.contacto_id
      ? await getOrCreateConversacionContacto(documento.empresa_id, documento.contacto_id)
      : null;

    const folio = CotizacionEmailService.formatearFolio(documento.serie, documento.numero, documento.id);
    const from = smtpConfig.email_remitente || smtpConfig.smtp_user || null;
    const nombreRemitente = smtpConfig.nombre_remitente?.trim() || smtpConfig.email_remitente || smtpConfig.smtp_user || 'Tu asesor';
    const cliente = documento.cliente_nombre?.trim() || 'cliente';
    const plantilla = await obtenerPlantillaEmail(documento.empresa_id, 'cotizacion');

    if (!plantilla) {
      throw new Error('No hay plantilla de correo configurada para cotización');
    }

    const mensajePlantilla = CotizacionEmailService.renderTemplate(message, {
      cliente,
      folio,
      nombreRemitente,
    });
    const subjectFinal = CotizacionEmailService.renderTemplate(subject || plantilla.asunto, {
      cliente,
      folio,
      nombreRemitente,
    });
    const htmlBody = CotizacionEmailService.renderTemplate(plantilla.html, {
      cliente: CotizacionEmailService.escapeHtml(cliente),
      folio: CotizacionEmailService.escapeHtml(folio),
      nombreRemitente: CotizacionEmailService.escapeHtml(nombreRemitente),
      mensaje: CotizacionEmailService.escapeHtml(mensajePlantilla).replace(/\n/g, '<br />'),
    });
    const textBody = CotizacionEmailService.htmlToText(htmlBody);
    const contenidoMensaje = textBody;

    try {
      const response = await EmailService.sendMailForContext(
        {
          empresaId: documento.empresa_id,
          usuarioId: input.usuarioId ?? null,
        },
        {
          to,
          from: from ? (smtpConfig.nombre_remitente ? `${smtpConfig.nombre_remitente} <${from}>` : from) : undefined,
          subject: subjectFinal,
          text: textBody,
          html: htmlBody,
          attachments: [
            {
              filename: `Cotizacion-${folio}.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf',
            },
          ],
        }
      );

      if (conversacionId) {
        await registrarMensajeEmailSaliente({
          empresaId: documento.empresa_id,
          contactoId: documento.contacto_id,
          conversacionId,
          contenido: contenidoMensaje,
          emailTo: to,
          emailFrom: from,
          emailSubject: subjectFinal,
          status: 'sent',
          externalId: response.messageId ?? null,
          respuestaJson: CotizacionEmailService.serializarRespuesta(response),
        });

        await actualizarConversacionSaliente(conversacionId, documento.empresa_id);
      }

      await CotizacionEmailService.actualizarEstadoSeguimiento(documento.id, documento.empresa_id, 'enviado');

      return {
        ok: true,
        message: 'Cotización enviada correctamente por correo',
        messageId: response.messageId ?? null,
      };
    } catch (error) {
      if (conversacionId) {
        await registrarMensajeEmailSaliente({
          empresaId: documento.empresa_id,
          contactoId: documento.contacto_id,
          conversacionId,
          contenido: contenidoMensaje,
          emailTo: to,
          emailFrom: from,
          emailSubject: subjectFinal,
          status: 'failed',
          externalId: null,
          respuestaJson: {
            error: (error as Error)?.message || 'Error SMTP',
          },
        });

        await actualizarConversacionSaliente(conversacionId, documento.empresa_id);
      }

      throw error;
    }
  }

  private static async obtenerCotizacion(documentoId: number, empresaId: number): Promise<DocumentoCotizacionEmail> {
    const { rows } = await pool.query<DocumentoCotizacionEmail>(
      `SELECT d.id,
              d.empresa_id,
              d.contacto_principal_id AS contacto_id,
              c.nombre AS cliente_nombre,
              d.agente_id AS vendedor_id,
              d.tipo_documento,
              d.serie,
              d.numero,
              d.estado_seguimiento
         FROM documentos d
         LEFT JOIN contactos c ON c.id = d.contacto_principal_id
        WHERE d.id = $1
          AND d.empresa_id = $2
          AND LOWER(d.tipo_documento) = 'cotizacion'
        LIMIT 1`,
      [documentoId, empresaId]
    );

    const documento = rows[0] ?? null;
    if (!documento) {
      throw new Error('Cotización no encontrada');
    }

    return documento;
  }

  private static async generarPdf(documentoId: number, empresaId: number): Promise<Buffer> {
    const data = await obtenerDocumentoRepository(documentoId, empresaId, 'cotizacion');
    if (!data) {
      throw new Error('Cotización no encontrada para generar PDF');
    }

    return generarDocumentoPDF(data, empresaId);
  }

  private static async actualizarEstadoSeguimiento(documentoId: number, empresaId: number, estado: string) {
    await pool.query(
      `UPDATE documentos
          SET estado_seguimiento = $1
        WHERE id = $2
          AND empresa_id = $3`,
      [estado, documentoId, empresaId]
    );
  }

  private static formatearFolio(serie: string | null, numero: number | null, documentoId: number) {
    return formatearFolioDocumento(serie ?? '', Number(numero ?? documentoId));
  }

  private static serializarRespuesta(response: SentMessageInfo) {
    return {
      messageId: response.messageId ?? null,
      accepted: response.accepted.map(String),
      rejected: response.rejected.map(String),
      response: response.response,
      envelope: response.envelope,
    };
  }

  private static renderTemplate(template: string, variables: Record<string, string>) {
    return template.replace(/\{\{\s*(cliente|folio|nombreRemitente|mensaje)\s*\}\}/g, (_match, key: string) => {
      return variables[key] ?? '';
    });
  }

  private static htmlToText(html: string) {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\r/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      .trim();
  }

  private static escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}