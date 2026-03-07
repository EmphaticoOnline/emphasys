export type Empresa = {
  id: number;
  nombre: string;
};

export type User = {
  id: number;
  nombre: string;
  email: string;
};

export type SessionState = {
  token: string | null;
  user: User | null;
  empresas: Empresa[];
  empresaActivaId: number | null;
};
