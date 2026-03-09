import nodemailer, { SentMessageInfo, Transporter } from 'nodemailer';

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

  // Valida presencia de variables requeridas
  private static assertEnv(value: string | undefined, key: string): void {
    if (!value) {
      throw new Error(`Falta la variable de entorno ${key}`);
    }
  }
}
