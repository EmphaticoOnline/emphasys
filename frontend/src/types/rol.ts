export interface Rol {
  id: number;
  empresa_id: number;
  nombre: string;
  descripcion?: string | null;
  activo: boolean;
  created_at?: string;
}

export type RolPayload = Partial<Omit<Rol, 'id' | 'empresa_id' | 'created_at'>> & { empresa_id?: number };
