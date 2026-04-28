import { apiFetch } from './apiFetch';

export type ConfiguracionCorreo = {
  id?: number;
  empresa_id?: number;
  usuario_id?: number;
  scope?: 'empresa' | 'usuario';
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_password: string;
  smtp_secure: boolean;
  email_remitente: string;
  nombre_remitente: string;
  activo: boolean;
  tiene_password?: boolean;
};

export type ConfiguracionCorreoResponse = {
  configuracion: (Omit<ConfiguracionCorreo, 'smtp_password' | 'smtp_port'> & {
    smtp_port: number;
    tiene_password?: boolean;
  }) | null;
  configuracion_resuelta?: (Omit<ConfiguracionCorreo, 'smtp_password' | 'smtp_port'> & {
    smtp_port: number;
    tiene_password?: boolean;
  }) | null;
};

export type TestCorreoPayload = Partial<ConfiguracionCorreo> & {
  scope?: 'empresa' | 'usuario';
  usuario_id?: number;
  to?: string;
  subject?: string;
  text?: string;
};

export type TestCorreoResponse = {
  ok: true;
  message: string;
  accepted: string[];
  rejected: string[];
  response: string;
};

const EMPRESA_URL = '/api/configuracion/email';
const USUARIO_URL = '/api/configuracion/email/usuario';
const TEST_URL = '/api/configuracion/email/test';

export async function fetchConfiguracionCorreoEmpresa(): Promise<ConfiguracionCorreoResponse> {
  return apiFetch<ConfiguracionCorreoResponse>(EMPRESA_URL);
}

export async function guardarConfiguracionCorreoEmpresa(payload: Partial<ConfiguracionCorreo>) {
  return apiFetch<{ configuracion: ConfiguracionCorreoResponse['configuracion'] }>(EMPRESA_URL, {
    method: 'POST',
    body: payload as any,
  });
}

export async function fetchConfiguracionCorreoUsuario(usuarioId?: number | null): Promise<ConfiguracionCorreoResponse> {
  const qs = new URLSearchParams();
  if (usuarioId) qs.set('usuario_id', String(usuarioId));
  return apiFetch<ConfiguracionCorreoResponse>(qs.size ? `${USUARIO_URL}?${qs.toString()}` : USUARIO_URL);
}

export async function guardarConfiguracionCorreoUsuario(payload: Partial<ConfiguracionCorreo>) {
  return apiFetch<{ configuracion: ConfiguracionCorreoResponse['configuracion'] }>(USUARIO_URL, {
    method: 'POST',
    body: payload as any,
  });
}

export async function probarConfiguracionCorreo(payload: TestCorreoPayload) {
  return apiFetch<TestCorreoResponse>(TEST_URL, {
    method: 'POST',
    body: payload as any,
  });
}