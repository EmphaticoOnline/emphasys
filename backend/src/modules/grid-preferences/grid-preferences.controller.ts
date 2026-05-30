import { Request, Response } from 'express';
import { obtenerGridPreference, upsertGridPreference } from './grid-preferences.repository';
import type { GridDeviceProfile } from './grid-preferences.types';

const ALLOWED_DEVICE_PROFILES: GridDeviceProfile[] = ['desktop', 'tablet', 'mobile'];

function parsePantalla(value: unknown): string | null {
  const pantalla = String(value ?? '').trim();
  if (!pantalla) return null;
  if (pantalla.length > 120) return null;
  return pantalla;
}

function parsePerfilDispositivo(value: unknown): GridDeviceProfile | null {
  const perfil = String(value ?? '').trim().toLowerCase();
  if (!perfil) return null;

  if (ALLOWED_DEVICE_PROFILES.includes(perfil as GridDeviceProfile)) {
    return perfil as GridDeviceProfile;
  }

  return null;
}

export async function getGridPreference(req: Request, res: Response) {
  try {
    const usuarioId = Number(req.auth?.userId ?? 0);
    const empresaId = Number(req.context?.empresaId ?? 0);
    const pantalla = parsePantalla(req.params.pantalla);
    const perfilDispositivo = parsePerfilDispositivo(req.query.perfil_dispositivo);

    if (!usuarioId || !empresaId) {
      return res.status(401).json({ message: 'Contexto de autenticación inválido' });
    }
    if (!pantalla) {
      return res.status(400).json({ message: 'pantalla inválida' });
    }
    if (!perfilDispositivo) {
      return res.status(400).json({ message: 'perfil_dispositivo inválido' });
    }

    const record = await obtenerGridPreference({
      usuarioId,
      empresaId,
      pantalla,
      perfilDispositivo,
    });

    return res.json({
      pantalla,
      perfil_dispositivo: perfilDispositivo,
      preferencias: record?.preferencias ?? null,
      updated_at: record?.updated_at ?? null,
    });
  } catch (error) {
    console.error('Error al consultar preferencias de grid:', error);
    return res.status(500).json({ message: 'Error al consultar preferencias de grid' });
  }
}

export async function putGridPreference(req: Request, res: Response) {
  try {
    const usuarioId = Number(req.auth?.userId ?? 0);
    const empresaId = Number(req.context?.empresaId ?? 0);
    const pantalla = parsePantalla(req.params.pantalla);
    const perfilDispositivo = parsePerfilDispositivo(req.body?.perfil_dispositivo);
    const preferencias = req.body?.preferencias;

    if (!usuarioId || !empresaId) {
      return res.status(401).json({ message: 'Contexto de autenticación inválido' });
    }
    if (!pantalla) {
      return res.status(400).json({ message: 'pantalla inválida' });
    }
    if (!perfilDispositivo) {
      return res.status(400).json({ message: 'perfil_dispositivo inválido' });
    }
    if (!preferencias || typeof preferencias !== 'object' || Array.isArray(preferencias)) {
      return res.status(400).json({ message: 'preferencias inválidas' });
    }

    const saved = await upsertGridPreference(
      {
        usuarioId,
        empresaId,
        pantalla,
        perfilDispositivo,
      },
      preferencias as Record<string, unknown>
    );

    return res.json({
      pantalla: saved.pantalla,
      perfil_dispositivo: saved.perfil_dispositivo,
      preferencias: saved.preferencias,
      updated_at: saved.updated_at,
    });
  } catch (error) {
    console.error('Error al guardar preferencias de grid:', error);
    return res.status(500).json({ message: 'Error al guardar preferencias de grid' });
  }
}
