export type Empresa = {
  id: number;
  nombre: string;
};

export type User = {
  id: number;
  nombre: string;
  email: string;
  es_superadmin?: boolean;
  vendedor_contacto_id?: number | null;
  vendedor_contacto_nombre?: string | null;
};

export type SessionState = {
  token: string | null;
  user: User | null;
  empresas: Empresa[];
  empresaActivaId: number | null;
};
