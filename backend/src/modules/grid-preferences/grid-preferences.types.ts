export type GridDeviceProfile = 'desktop' | 'tablet' | 'mobile';

export type GridPreferencesRecord = {
  id: number;
  usuario_id: number;
  empresa_id: number;
  pantalla: string;
  perfil_dispositivo: GridDeviceProfile;
  preferencias: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type GridPreferenceScope = {
  usuarioId: number;
  empresaId: number;
  pantalla: string;
  perfilDispositivo: GridDeviceProfile;
};
