export interface Cuenta {
  id: number;
  empresa_id: number;
  cuenta: string;
  descripcion: string;
  rango_cuenta_id: number | null;
  afectable: boolean;
  cuenta_padre_id: number | null;
  nivel: number;
  subgrupo: string | null;
  codigo_agrupador_sat: string | null;
  rubro_presupuesto: string | null;
  no_considerar_presupuesto: boolean;
  observaciones: string | null;
  activa: boolean;
  creado_en: string;
  actualizado_en: string;
}

export type CuentaEdicionInput = {
  descripcion: string;
  codigo_agrupador_sat?: string | null;
  observaciones?: string | null;
  activa?: boolean;
};

export type CuentaNuevaInput = {
  cuenta: string;
  descripcion: string;
  codigo_agrupador_sat?: string | null;
  observaciones?: string | null;
  activa?: boolean;
  descripciones_faltantes?: Record<string, string>;
};

export interface NivelCuentaInfo {
  cuenta: string;
  nivel: number;
  existe: boolean;
  id: number | null;
  requiere_descripcion: boolean;
  es_cuenta_final: boolean;
}

export interface ValidarNuevaCuentaResponse {
  valida: boolean;
  message?: string;
  nivel?: number;
  cuentas?: NivelCuentaInfo[];
  cuenta_existente?: boolean;
  naturaleza_saldo?: 'D' | 'A' | null;
}

export interface ConfiguracionContable {
  id: number;
  empresa_id: number;
  caracter_separador: string;
  estructura_cuentas: string;
  creado_en: string;
  actualizado_en: string;
}

export type ConfiguracionContableInput = {
  estructura_cuentas: string;
  caracter_separador: string;
};
