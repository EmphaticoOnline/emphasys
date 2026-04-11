export type Usuario = {
  id: number;
  nombre: string;
  email: string;
  activo: boolean;
  es_superadmin: boolean;
  vendedor_contacto_id?: number | null;
  vendedor_contacto_nombre?: string | null;
  created_at: string;
};

export type UsuarioDetalle = Usuario & {
  empresas: { empresa_id: number; activo: boolean }[];
  roles: { empresa_id: number; rol_id: number }[];
};

export type UsuarioPayload = {
  nombre: string;
  email: string;
  password?: string;
  es_superadmin?: boolean;
  activo?: boolean;
  vendedor_contacto_id?: number | null;
};
