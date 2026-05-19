import { Request, Response } from 'express';
import {
  actualizarCfdiPacConfig,
  crearCfdiPacConfig,
  listarCfdiPacConfigs,
  obtenerCfdiPacConfigPorId,
  type CreateCfdiPacConfigPayload,
  type CfdiPacConfigRow,
  type UpdateCfdiPacConfigPayload,
} from './cfdi-pac-config.repository';

type PublicCfdiPacConfig = Omit<CfdiPacConfigRow, 'password'> & {
  password: string;
  tiene_password: boolean;
};

function toPublicConfig(row: CfdiPacConfigRow): PublicCfdiPacConfig {
  return {
    ...row,
    password: '',
    tiene_password: Boolean(row.password),
  };
}

function normalizeString(value: unknown): string {
  return String(value ?? '').trim();
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  return Boolean(value);
}

function validatePayload(body: any, options?: { requirePassword?: boolean }): UpdateCfdiPacConfigPayload {
  const pac = normalizeString(body?.pac);
  const modo = normalizeString(body?.modo) as UpdateCfdiPacConfigPayload['modo'];
  const base_url = normalizeString(body?.base_url);
  const username = normalizeString(body?.username);
  const stamp_path = normalizeString(body?.stamp_path);
  const passwordRaw = body?.password;
  const password = passwordRaw === undefined || passwordRaw === null ? null : String(passwordRaw);
  const activo = parseBoolean(body?.activo);

  if (!pac) throw new Error('pac es obligatorio');
  if (modo !== 'sandbox' && modo !== 'produccion') throw new Error('modo debe ser sandbox o produccion');
  if (!base_url) throw new Error('base_url es obligatorio');
  if (!username) throw new Error('username es obligatorio');
  if (options?.requirePassword && !String(password ?? '').trim()) throw new Error('password es obligatorio');
  if (!stamp_path) throw new Error('stamp_path es obligatorio');

  return {
    pac,
    modo,
    base_url,
    username,
    password,
    stamp_path,
    activo,
  };
}

export async function crearCfdiPacConfigController(req: Request, res: Response) {
  try {
    const payload = validatePayload(req.body || {}, { requirePassword: true }) as CreateCfdiPacConfigPayload;
    const created = await crearCfdiPacConfig({
      ...payload,
      password: String(payload.password ?? ''),
    });

    return res.status(201).json({ configuracion: toPublicConfig(created) });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'No se pudo crear la configuración PAC CFDI';
    const status =
      error?.code === '23505'
        ? 409
        : message.includes('obligatorio') || message.includes('sandbox') || message.includes('produccion')
          ? 400
          : 500;

    console.error('Error al crear configuración PAC CFDI', error);
    return res.status(status).json({
      message: error?.code === '23505' ? 'Ya existe una configuración para ese PAC y modo' : message,
    });
  }
}

export async function listarCfdiPacConfigController(_req: Request, res: Response) {
  try {
    const configuraciones = await listarCfdiPacConfigs();
    return res.json({ configuraciones: configuraciones.map(toPublicConfig) });
  } catch (error) {
    console.error('Error al listar configuración PAC CFDI', error);
    return res.status(500).json({ message: 'No se pudo obtener la configuración PAC CFDI' });
  }
}

export async function actualizarCfdiPacConfigController(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: 'id inválido' });
    }

    const actual = await obtenerCfdiPacConfigPorId(id);
    if (!actual) {
      return res.status(404).json({ message: 'Configuración PAC CFDI no encontrada' });
    }

    const payload = validatePayload(req.body || {});
    const updated = await actualizarCfdiPacConfig(id, payload);

    if (!updated) {
      return res.status(404).json({ message: 'Configuración PAC CFDI no encontrada' });
    }

    return res.json({ configuracion: toPublicConfig(updated) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo guardar la configuración PAC CFDI';
    const status =
      message.includes('obligatorio') ||
      message.includes('sandbox') ||
      message.includes('produccion')
        ? 400
        : 500;

    console.error('Error al actualizar configuración PAC CFDI', error);
    return res.status(status).json({ message });
  }
}