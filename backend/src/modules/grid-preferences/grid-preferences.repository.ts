import pool from '../../config/database';
import type { GridPreferenceScope, GridPreferencesRecord } from './grid-preferences.types';

export async function obtenerGridPreference(scope: GridPreferenceScope): Promise<GridPreferencesRecord | null> {
  const { rows } = await pool.query<GridPreferencesRecord>(
    `SELECT id,
            usuario_id,
            empresa_id,
            pantalla,
            perfil_dispositivo,
            preferencias,
            created_at,
            updated_at
       FROM core.grid_preferences
      WHERE usuario_id = $1
        AND empresa_id = $2
        AND pantalla = $3
        AND perfil_dispositivo = $4
      LIMIT 1`,
    [scope.usuarioId, scope.empresaId, scope.pantalla, scope.perfilDispositivo]
  );

  return rows[0] ?? null;
}

export async function upsertGridPreference(
  scope: GridPreferenceScope,
  preferencias: Record<string, unknown>
): Promise<GridPreferencesRecord> {
  const { rows } = await pool.query<GridPreferencesRecord>(
    `INSERT INTO core.grid_preferences (
        usuario_id,
        empresa_id,
        pantalla,
        perfil_dispositivo,
        preferencias,
        created_at,
        updated_at
     )
     VALUES ($1, $2, $3, $4, $5::jsonb, now(), now())
     ON CONFLICT (usuario_id, empresa_id, pantalla, perfil_dispositivo)
     DO UPDATE
           SET preferencias = EXCLUDED.preferencias,
               updated_at = now()
     RETURNING id,
               usuario_id,
               empresa_id,
               pantalla,
               perfil_dispositivo,
               preferencias,
               created_at,
               updated_at`,
    [
      scope.usuarioId,
      scope.empresaId,
      scope.pantalla,
      scope.perfilDispositivo,
      JSON.stringify(preferencias ?? {}),
    ]
  );

  return rows[0];
}
