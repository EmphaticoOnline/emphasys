export type ParametroOpcion = {
  opcion_id?: number;
  valor: string;
  etiqueta: string;
  orden: number | null;
};

export type ParametroSistema = {
  parametro_id: number;
  clave: string;
  nombre: string;
  tipo_dato: string | null;
  tipo_control: "input" | "checkbox" | "dropdown" | string;
  valor_default: string | null;
  valor_empresa: string | null;
  valor_resuelto: string | null;
  tiene_valor_empresa: boolean;
  parametro_padre_id: number | null;
  valor_activacion: string | null;
  opciones: ParametroOpcion[];
};

export type ParametrosModulo = {
  modulo_id: number | null;
  modulo_clave: string | null;
  modulo_nombre: string | null;
  parametros: ParametroSistema[];
};