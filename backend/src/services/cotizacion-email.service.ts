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
import { COTIZACION_ESTATUS_DOCUMENTO_ENVIADO } from '../modules/documentos/cotizacion-status';

type TipoDocumentoEnviable = 'cotizacion' | 'orden_servicio' | 'orden_compra';

type EnviarDocumentoEmailInput = {
  documentoId: number;
  empresaId: number;
  usuarioId?: number | null;
  to: string;
  subject: string;
  message: string;
  tipoDocumento?: TipoDocumentoEnviable;
};

type DocumentoEmail = {
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

const DOCUMENTO_LABELS: Record<TipoDocumentoEnviable, string> = {
  cotizacion: 'Cotización',
  orden_servicio: 'Orden de servicio',
  orden_compra: 'Orden de compra',
};

const PLANTILLA_EMAIL_FALLBACK: Record<TipoDocumentoEnviable, string> = {
  cotizacion: 'cotizacion',
  orden_servicio: 'cotizacion',
  orden_compra: 'cotizacion',
};

const ARCHIVO_ADJUNTO_PREFIX: Record<TipoDocumentoEnviable, string> = {
  cotizacion: 'Cotizacion',
  orden_servicio: 'OrdenDeServicio',
  orden_compra: 'OrdenDeCompra',
};

const esTipoDocumentoEnviable = (value: string): value is TipoDocumentoEnviable =>
  value === 'cotizacion' || value === 'orden_servicio' || value === 'orden_compra';

export class CotizacionEmailService {
  public static async enviarCotizacion(input: Omit<EnviarDocumentoEmailInput, 'tipoDocumento'>) {
    return CotizacionEmailService.enviarDocumento({ ...input, tipoDocumento: 'cotizacion' });
  }

  public static async enviarDocumento(input: EnviarDocumentoEmailInput) {
    const tipoDocumento = input.tipoDocumento ?? 'cotizacion';
    if (!esTipoDocumentoEnviable(tipoDocumento)) {
      throw new Error('Tipo de documento no soportado para envío por correo');
    }

    const to = input.to.trim();
    const subject = input.subject.trim();
    const message = input.message?.trim() || '';
    const documentoLabel = DOCUMENTO_LABELS[tipoDocumento];

    if (!to) {
      throw new Error('El correo destino es obligatorio');
    }

    const documento = await CotizacionEmailService.obtenerDocumento(input.documentoId, input.empresaId, tipoDocumento);
    const pdfBuffer = await CotizacionEmailService.generarPdf(input.documentoId, input.empresaId, tipoDocumento);
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
    const plantilla = await obtenerPlantillaEmail(documento.empresa_id, tipoDocumento)
      || (PLANTILLA_EMAIL_FALLBACK[tipoDocumento] !== tipoDocumento
        ? await obtenerPlantillaEmail(documento.empresa_id, PLANTILLA_EMAIL_FALLBACK[tipoDocumento])
        : null);

    if (!plantilla) {
      throw new Error(`No hay plantilla de correo configurada para ${documentoLabel.toLowerCase()}`);
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
              filename: `${ARCHIVO_ADJUNTO_PREFIX[tipoDocumento]}-${folio}.pdf`,
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

      await CotizacionEmailService.actualizarEstatusDocumento(documento.id, documento.empresa_id, COTIZACION_ESTATUS_DOCUMENTO_ENVIADO, tipoDocumento);

      return {
        ok: true,
        message: `${documentoLabel} enviada correctamente por correo`,
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

  private static async obtenerDocumento(documentoId: number, empresaId: number, tipoDocumento: TipoDocumentoEnviable): Promise<DocumentoEmail> {
    const { rows } = await pool.query<DocumentoEmail>(
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
          AND LOWER(d.tipo_documento) = $3
        LIMIT 1`,
      [documentoId, empresaId, tipoDocumento]
    );

    const documento = rows[0] ?? null;
    if (!documento) {
      throw new Error(`${DOCUMENTO_LABELS[tipoDocumento]} no encontrada`);
    }

    return documento;
  }

  private static async generarPdf(documentoId: number, empresaId: number, tipoDocumento: TipoDocumentoEnviable): Promise<Buffer> {
    const data = await obtenerDocumentoRepository(documentoId, empresaId, tipoDocumento);
    if (!data) {
      throw new Error(`${DOCUMENTO_LABELS[tipoDocumento]} no encontrada para generar PDF`);
    }

    return generarDocumentoPDF(data, empresaId);
  }

  private static async actualizarEstatusDocumento(documentoId: number, empresaId: number, estatus: string, tipoDocumento: TipoDocumentoEnviable) {
    await pool.query(
      `UPDATE documentos
          SET estatus_documento = $1
        WHERE id = $2
          AND empresa_id = $3
          AND LOWER(tipo_documento) = $4`,
      [estatus, documentoId, empresaId, tipoDocumento]
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