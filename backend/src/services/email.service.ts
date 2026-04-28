import nodemailer, { SentMessageInfo, Transporter } from 'nodemailer';
import { getConfiguracionEmailPrivada, type ConfiguracionEmailPrivada } from '../modules/configuracion/email/email.service';

// Tipado de adjuntos permitidos
export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

// Tipado de opciones de envío
export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
  from?: string;
}

export interface EmailDeliveryContext {
  empresaId: number;
  usuarioId?: number | null;
}

// Servicio reutilizable de correo
export class EmailService {
  // Envía un correo utilizando SMTP y nodemailer
  public static async sendMail(options: EmailOptions): Promise<SentMessageInfo> {
    const transporter = EmailService.createTransporter();

    // Arma el payload respetando un remitente por defecto
    const mailOptions = {
      from: process.env.SMTP_FROM,
      ...options,
    };

    // Envía el correo y devuelve el resultado
    return transporter.sendMail(mailOptions);
  }

  public static async sendMailForContext(
    context: EmailDeliveryContext,
    options: EmailOptions
  ): Promise<SentMessageInfo> {
    const config = await getConfiguracionEmailPrivada(context.empresaId, context.usuarioId ?? null);

    if (!config) {
      throw new Error('No hay configuración SMTP activa para esta empresa o usuario');
    }

    const transporter = EmailService.createTransporterFromConfig(config);

    return transporter.sendMail({
      from: options.from || EmailService.formatFrom(config),
      ...options,
    });
  }

  // Construye un transporter SMTP basado en variables de entorno
  private static createTransporter(): Transporter {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

    EmailService.assertEnv(SMTP_HOST, 'SMTP_HOST');
    EmailService.assertEnv(SMTP_PORT, 'SMTP_PORT');
    EmailService.assertEnv(SMTP_USER, 'SMTP_USER');
    EmailService.assertEnv(SMTP_PASS, 'SMTP_PASS');

    const port = Number(SMTP_PORT);
    const secure = port === 465; // TLS implícito en 465

    return nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }

  private static createTransporterFromConfig(config: ConfiguracionEmailPrivada): Transporter {
    return nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port,
      secure: config.smtp_secure,
      auth: config.smtp_user
        ? {
            user: config.smtp_user,
            pass: config.smtp_password ?? '',
          }
        : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
  }

  private static formatFrom(config: ConfiguracionEmailPrivada): string | undefined {
    const email = config.email_remitente || config.smtp_user;
    if (!email) return undefined;
    return config.nombre_remitente ? `${config.nombre_remitente} <${email}>` : email;
  }

  // Valida presencia de variables requeridas
  private static assertEnv(value: string | undefined, key: string): void {
    if (!value) {
      throw new Error(`Falta la variable de entorno ${key}`);
    }
  }
}
