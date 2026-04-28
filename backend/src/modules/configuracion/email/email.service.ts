import nodemailer from 'nodemailer';
import { decryptSecret, encryptSecret } from '../../../utils/secret-crypto';
import {
  ConfiguracionEmailBaseRow,
  ConfiguracionEmailEmpresaRow,
  obtenerConfiguracionEmailActivaPorEmpresa,
  obtenerConfiguracionEmailPorEmpresa,
  upsertConfiguracionEmailEmpresa,
} from './email.repository';
import {
  ConfiguracionEmailUsuarioRow,
  obtenerConfiguracionEmailActivaPorUsuario,
  obtenerConfiguracionEmailPorUsuario,
  upsertConfiguracionEmailUsuario,
} from './email-usuario.repository';

export type ConfiguracionEmailInput = {
  smtp_host?: unknown;
  smtp_port?: unknown;
  smtp_user?: unknown;
  smtp_password?: unknown;
  smtp_secure?: unknown;
  email_remitente?: unknown;
  nombre_remitente?: unknown;
  activo?: unknown;
};

export type ConfiguracionEmailPublica = {
  id: number;
  empresa_id: number;
  usuario_id?: number;
  scope: 'empresa' | 'usuario';
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_secure: boolean;
  email_remitente: string | null;
  nombre_remitente: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
  tiene_password: boolean;
};

export type ConfiguracionEmailPrivada = {
  scope: 'empresa' | 'usuario';
  empresa_id: number;
  usuario_id?: number;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string | null;
  smtp_secure: boolean;
  email_remitente: string | null;
  nombre_remitente: string | null;
  activo: boolean;
};

export type TestEmailInput = ConfiguracionEmailInput & {
  scope?: unknown;
  to?: unknown;
  subject?: unknown;
  text?: unknown;
};

type ConfiguracionEmailResolved = {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string | null;
  smtp_secure: boolean;
  email_remitente: string | null;
  nombre_remitente: string | null;
  activo: boolean;
};

export async function obtenerConfiguracionEmailActual(
  empresaId: number
): Promise<ConfiguracionEmailPublica | null> {
  const config = await obtenerConfiguracionEmailPorEmpresa(empresaId);
  return config ? sanitizarConfiguracionEmpresa(config) : null;
}

export async function obtenerConfiguracionEmailUsuarioActual(
  empresaId: number,
  usuarioId: number
): Promise<ConfiguracionEmailPublica | null> {
  const config = await obtenerConfiguracionEmailPorUsuario(empresaId, usuarioId);
  return config ? sanitizarConfiguracionUsuario(config) : null;
}

export async function getConfiguracionEmail(
  empresaId: number,
  usuarioId?: number | null
): Promise<ConfiguracionEmailPublica | null> {
  if (usuarioId) {
    const configUsuario = await obtenerConfiguracionEmailActivaPorUsuario(empresaId, usuarioId);
    if (configUsuario) {
      return sanitizarConfiguracionUsuario(configUsuario);
    }
  }

  const configEmpresa = await obtenerConfiguracionEmailActivaPorEmpresa(empresaId);
  return configEmpresa ? sanitizarConfiguracionEmpresa(configEmpresa) : null;
}

export async function getConfiguracionEmailPrivada(
  empresaId: number,
  usuarioId?: number | null
): Promise<ConfiguracionEmailPrivada | null> {
  if (usuarioId) {
    const configUsuario = await obtenerConfiguracionEmailActivaPorUsuario(empresaId, usuarioId);
    if (configUsuario) {
      return mapearConfiguracionPrivada(configUsuario, 'usuario');
    }
  }

  const configEmpresa = await obtenerConfiguracionEmailActivaPorEmpresa(empresaId);
  return configEmpresa ? mapearConfiguracionPrivada(configEmpresa, 'empresa') : null;
}

export async function guardarConfiguracionEmail(
  empresaId: number,
  input: ConfiguracionEmailInput
): Promise<ConfiguracionEmailPublica> {
  const existente = await obtenerConfiguracionEmailPorEmpresa(empresaId);
  console.log('[SMTP SAVE][service][empresa] input', {
    empresaId,
    smtp_user: input.smtp_user,
    smtp_password_present: Boolean(input.smtp_password),
    smtp_password_length: String(input.smtp_password ?? '').length,
  });
  const payload = normalizarConfiguracion(input, existente);

  console.log('[SMTP SAVE][service][empresa] payload normalizado', {
    empresaId,
    smtp_user: payload.smtp_user,
    smtp_password_present: Boolean(payload.smtp_password),
    smtp_password_length: payload.smtp_password?.length ?? 0,
  });

  const encryptedPassword = payload.smtp_password ? encryptSecret(payload.smtp_password) : null;

  console.log('[SMTP SAVE][service][empresa] password cifrado', {
    empresaId,
    beforeEncryptLength: payload.smtp_password?.length ?? 0,
    afterEncryptLength: encryptedPassword?.length ?? 0,
  });

  const saved = await upsertConfiguracionEmailEmpresa(empresaId, {
    ...payload,
    smtp_password: encryptedPassword,
  });

  return sanitizarConfiguracionEmpresa(saved);
}

export async function guardarConfiguracionEmailUsuario(
  empresaId: number,
  usuarioId: number,
  input: ConfiguracionEmailInput
): Promise<ConfiguracionEmailPublica> {
  const existente = await obtenerConfiguracionEmailPorUsuario(empresaId, usuarioId);
  console.log('[SMTP SAVE][service][usuario] input', {
    empresaId,
    usuarioId,
    smtp_user: input.smtp_user,
    smtp_password_present: Boolean(input.smtp_password),
    smtp_password_length: String(input.smtp_password ?? '').length,
  });
  const payload = normalizarConfiguracion(input, existente);

  console.log('[SMTP SAVE][service][usuario] payload normalizado', {
    empresaId,
    usuarioId,
    smtp_user: payload.smtp_user,
    smtp_password_present: Boolean(payload.smtp_password),
    smtp_password_length: payload.smtp_password?.length ?? 0,
  });

  const encryptedPassword = payload.smtp_password ? encryptSecret(payload.smtp_password) : null;

  console.log('[SMTP SAVE][service][usuario] password cifrado', {
    empresaId,
    usuarioId,
    beforeEncryptLength: payload.smtp_password?.length ?? 0,
    afterEncryptLength: encryptedPassword?.length ?? 0,
  });

  const saved = await upsertConfiguracionEmailUsuario(empresaId, usuarioId, {
    ...payload,
    smtp_password: encryptedPassword,
  });

  return sanitizarConfiguracionUsuario(saved);
}

export async function probarConfiguracionEmail(
  empresaId: number,
  input: TestEmailInput,
  emailUsuarioAutenticado?: string,
  usuarioId?: number | null
): Promise<{ ok: true; message: string; accepted: string[]; rejected: string[]; response: string }>{
  const scope = normalizarScope(input.scope);
  const { config: existente, resolvedScope } = await obtenerConfiguracionPruebaDesdeScope(empresaId, usuarioId ?? null, scope);
  const usingStoredPassword = debeUsarPasswordGuardado(input.smtp_password, existente);
  const payload = tieneCredencialesEnPayload(input)
    ? normalizarConfiguracion(input, existente)
    : normalizarConfiguracionDesdeBD(existente);

  const secureFinal = payload.smtp_secure;
  const requireTLSFinal = false;

  console.log('[SMTP TEST] configuracion', {
    scopeRequested: scope,
    scopeResolved: resolvedScope,
    usingStoredConfig: !tieneCredencialesEnPayload(input) || usingStoredPassword,
    empresaId,
    usuarioId: usuarioId ?? null,
    smtp_host: payload.smtp_host,
    smtp_port: payload.smtp_port,
    smtp_secure_received: input.smtp_secure ?? null,
    smtp_secure_stored: existente?.smtp_secure ?? null,
    secureFinal,
    requireTLSFinal,
    smtp_user: payload.smtp_user,
    email_remitente: payload.email_remitente,
    passwordPresent: Boolean(payload.smtp_password),
    passwordLength: payload.smtp_password?.length ?? 0,
  });

  const transporterOptions = {
    host: payload.smtp_host,
    port: payload.smtp_port,
    secure: secureFinal,
    auth: payload.smtp_user
      ? {
          user: payload.smtp_user,
          pass: payload.smtp_password ?? '',
        }
      : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  };

  const transporter = nodemailer.createTransport(transporterOptions);

  try {
    await transporter.verify();

    const to = normalizarTexto(input.to)
      || emailUsuarioAutenticado
      || payload.email_remitente
      || payload.smtp_user;

    if (!to) {
      throw new Error('Define un destinatario para el correo de prueba');
    }

    const info = await transporter.sendMail({
      from: formatearRemitente(payload.nombre_remitente, payload.email_remitente || payload.smtp_user),
      to,
      subject: normalizarTexto(input.subject) || 'Prueba de configuracion SMTP',
      text: normalizarTexto(input.text)
        || 'Este es un correo de prueba enviado desde la configuracion SMTP de Emphasys.',
    });

    return {
      ok: true,
      message: 'Conexion SMTP verificada y correo de prueba enviado correctamente',
      accepted: info.accepted.map(String),
      rejected: info.rejected.map(String),
      response: info.response,
    };
  } catch (error) {
    const smtpError = error as NodeJS.ErrnoException & {
      response?: string;
      responseCode?: number;
      command?: string;
      code?: string;
    };

    console.error('[SMTP TEST] error', {
      message: smtpError?.message,
      code: smtpError?.code,
      command: smtpError?.command,
      response: smtpError?.response,
      responseCode: smtpError?.responseCode,
      stack: smtpError?.stack,
    });

    throw new Error(formatearErrorSmtp(error));
  }
}

function sanitizarConfiguracionEmpresa(row: ConfiguracionEmailEmpresaRow): ConfiguracionEmailPublica {
  return {
    id: row.id,
    empresa_id: row.empresa_id,
    scope: 'empresa',
    smtp_host: row.smtp_host,
    smtp_port: row.smtp_port,
    smtp_user: row.smtp_user,
    smtp_secure: row.smtp_secure,
    email_remitente: row.email_remitente,
    nombre_remitente: row.nombre_remitente,
    activo: row.activo,
    created_at: row.created_at,
    updated_at: row.updated_at,
    tiene_password: Boolean(row.smtp_password),
  };
}

function sanitizarConfiguracionUsuario(row: ConfiguracionEmailUsuarioRow): ConfiguracionEmailPublica {
  return {
    id: row.id,
    usuario_id: row.usuario_id,
    empresa_id: row.empresa_id,
    scope: 'usuario',
    smtp_host: row.smtp_host,
    smtp_port: row.smtp_port,
    smtp_user: row.smtp_user,
    smtp_secure: row.smtp_secure,
    email_remitente: row.email_remitente,
    nombre_remitente: row.nombre_remitente,
    activo: row.activo,
    created_at: row.created_at,
    updated_at: row.updated_at,
    tiene_password: Boolean(row.smtp_password),
  };
}

function mapearConfiguracionPrivada(
  row: ConfiguracionEmailBaseRow | ConfiguracionEmailUsuarioRow,
  scope: 'empresa' | 'usuario'
): ConfiguracionEmailPrivada {
  return {
    scope,
    empresa_id: row.empresa_id,
    usuario_id: 'usuario_id' in row ? row.usuario_id : undefined,
    smtp_host: row.smtp_host,
    smtp_port: row.smtp_port,
    smtp_user: row.smtp_user,
    smtp_password: row.smtp_password ? decryptSecret(row.smtp_password) : null,
    smtp_secure: row.smtp_secure,
    email_remitente: row.email_remitente,
    nombre_remitente: row.nombre_remitente,
    activo: row.activo,
  };
}

function normalizarConfiguracion(
  input: ConfiguracionEmailInput,
  existente: ConfiguracionEmailBaseRow | null
): ConfiguracionEmailResolved {
  const smtpHost = normalizarTexto(input.smtp_host) || existente?.smtp_host || '';
  const smtpUser = normalizarTexto(input.smtp_user) || existente?.smtp_user || '';
  const smtpPortRaw = input.smtp_port ?? existente?.smtp_port;
  const smtpPort = Number(smtpPortRaw);
  const smtpPasswordInput = input.smtp_password;

  if (!smtpHost) {
    throw new Error('smtp_host es obligatorio');
  }

  if (!Number.isFinite(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
    throw new Error('smtp_port debe ser un numero valido entre 1 y 65535');
  }

  if (!smtpUser) {
    throw new Error('smtp_user es obligatorio');
  }

  let smtpPassword: string | null;
  if (smtpPasswordInput === undefined) {
    smtpPassword = existente?.smtp_password ? decryptSecret(existente.smtp_password) : null;
  } else {
    const normalized = normalizarTexto(smtpPasswordInput, false);
    if (normalized === '') {
      smtpPassword = existente?.smtp_password ? decryptSecret(existente.smtp_password) : null;
    } else {
      smtpPassword = normalized;
    }
  }

  return {
    smtp_host: smtpHost,
    smtp_port: smtpPort,
    smtp_user: smtpUser,
    smtp_password: smtpPassword,
    smtp_secure: normalizarBooleano(input.smtp_secure, existente?.smtp_secure ?? smtpPort === 465),
    email_remitente: normalizarTexto(input.email_remitente),
    nombre_remitente: normalizarTexto(input.nombre_remitente),
    activo: normalizarBooleano(input.activo, existente?.activo ?? true),
  };
}

function normalizarConfiguracionDesdeBD(
  existente: ConfiguracionEmailBaseRow | null
): ConfiguracionEmailResolved {
  if (!existente) {
    throw new Error('No existe configuracion SMTP activa para el alcance solicitado');
  }

  return {
    smtp_host: existente.smtp_host,
    smtp_port: existente.smtp_port,
    smtp_user: existente.smtp_user,
    smtp_password: existente.smtp_password ? decryptSecret(existente.smtp_password) : null,
    smtp_secure: existente.smtp_secure,
    email_remitente: existente.email_remitente,
    nombre_remitente: existente.nombre_remitente,
    activo: existente.activo,
  };
}

async function obtenerConfiguracionPruebaDesdeScope(
  empresaId: number,
  usuarioId: number | null,
  scope: 'empresa' | 'usuario' | 'auto'
): Promise<{ config: ConfiguracionEmailBaseRow | null; resolvedScope: 'empresa' | 'usuario' }> {
  if (scope === 'empresa') {
    return {
      config: await obtenerConfiguracionEmailActivaPorEmpresa(empresaId),
      resolvedScope: 'empresa',
    };
  }

  if (scope === 'usuario') {
    if (!usuarioId) {
      throw new Error('No hay usuario autenticado para probar la configuracion SMTP de usuario');
    }

    return {
      config: await obtenerConfiguracionEmailActivaPorUsuario(empresaId, usuarioId),
      resolvedScope: 'usuario',
    };
  }

  if (usuarioId) {
    const configUsuario = await obtenerConfiguracionEmailActivaPorUsuario(empresaId, usuarioId);
    if (configUsuario) {
      return {
        config: configUsuario,
        resolvedScope: 'usuario',
      };
    }
  }

  return {
    config: await obtenerConfiguracionEmailActivaPorEmpresa(empresaId),
    resolvedScope: 'empresa',
  };
}

function tieneCredencialesEnPayload(input: ConfiguracionEmailInput): boolean {
  return input.smtp_host !== undefined || input.smtp_port !== undefined || input.smtp_user !== undefined || input.smtp_password !== undefined;
}

function debeUsarPasswordGuardado(
  smtpPasswordInput: unknown,
  existente: ConfiguracionEmailBaseRow | null
): boolean {
  if (!existente?.smtp_password) {
    return false;
  }

  if (smtpPasswordInput === undefined || smtpPasswordInput === null) {
    return true;
  }

  return String(smtpPasswordInput) === '';
}

function normalizarScope(value: unknown): 'empresa' | 'usuario' | 'auto' {
  const normalized = normalizarTexto(value)?.toLowerCase();

  if (normalized === 'empresa' || normalized === 'usuario') {
    return normalized;
  }

  return 'auto';
}

function normalizarTexto(value: unknown, trim = true): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value);
  const finalValue = trim ? normalized.trim() : normalized;
  return finalValue;
}

function normalizarBooleano(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'si', 'sí', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  return fallback;
}

function formatearRemitente(nombre: string | null, email: string | null): string | undefined {
  if (!email) {
    return undefined;
  }

  return nombre ? `${nombre} <${email}>` : email;
}

function formatearErrorSmtp(error: unknown): string {
  const smtpError = error as NodeJS.ErrnoException & { response?: string; code?: string };

  switch (smtpError?.code) {
    case 'EAUTH':
      return 'Autenticacion SMTP fallida. Verifica usuario y password.';
    case 'ECONNECTION':
      return 'No fue posible establecer conexion con el servidor SMTP.';
    case 'ETIMEDOUT':
      return 'La conexion SMTP expiro. Verifica host, puerto y firewall.';
    case 'ESOCKET':
      return 'Error de socket SMTP. Revisa el host, puerto y si la conexion es segura.';
    default:
      return smtpError?.response || smtpError?.message || 'Error desconocido al probar SMTP';
  }
}