import { apiFetch } from './apiFetch';

export type GridDeviceProfile = 'desktop' | 'tablet' | 'mobile';

export type GridPreferencesPayload = {
  version?: number;
  columnWidths?: Record<string, number>;
  columnVisibilityModel?: Record<string, boolean>;
  columnOrder?: string[];
  sortModel?: unknown;
  filterModel?: unknown;
  externalFilters?: Record<string, unknown>;
};

type GridPreferenceResponse = {
  pantalla: string;
  perfil_dispositivo: GridDeviceProfile;
  preferencias: GridPreferencesPayload | null;
  updated_at: string | null;
};

export async function fetchGridPreferences(
  pantalla: string,
  perfilDispositivo: GridDeviceProfile
): Promise<GridPreferencesPayload | null> {
  const encodedPantalla = encodeURIComponent(pantalla);
  const response = await apiFetch<GridPreferenceResponse>(
    `/api/grid-preferences/${encodedPantalla}?perfil_dispositivo=${perfilDispositivo}`
  );

  return response?.preferencias ?? null;
}

export async function saveGridPreferences(
  pantalla: string,
  perfilDispositivo: GridDeviceProfile,
  preferencias: GridPreferencesPayload
): Promise<GridPreferencesPayload> {
  const encodedPantalla = encodeURIComponent(pantalla);
  const response = await apiFetch<GridPreferenceResponse>(`/api/grid-preferences/${encodedPantalla}`, {
    method: 'PUT',
    body: {
      perfil_dispositivo: perfilDispositivo,
      preferencias,
    },
  });

  return response.preferencias ?? {};
}
