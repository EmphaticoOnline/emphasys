export type TipoDatoCampo = 'texto' | 'numero' | 'fecha' | 'booleano' | 'lista';

export type CampoConfiguracion = {
  id: number;
  empresa_id: number;
  entidad_tipo_id: number;
  entidad_tipo_codigo: string | null;
  tipo_documento: string | null;
  nombre: string;
  clave: string | null;
  tipo_dato: TipoDatoCampo;
  tipo_control: string | null;
  catalogo_tipo_id: number | null;
  catalogo_tipo_nombre: string | null;
  campo_padre_id: number | null;
  obligatorio: boolean;
  activo: boolean;
  orden: number | null;
};

export type CampoValorPayload = {
  campo_id: number;
  catalogo_id?: number | null;
  valor_texto?: string | null;
  valor_numero?: number | null;
  valor_fecha?: string | null;
  valor_boolean?: boolean | null;
};

export type CampoValorGuardado = {
  campo_id: number;
  catalogo_id: number | null;
  valor_texto: string | null;
  valor_numero: number | null;
  valor_fecha: string | null;
  valor_boolean: boolean | null;
};

export type CatalogoValor = {
  id: number;
  empresa_id: number;
  tipo_catalogo_id: number;
  clave: string | null;
  descripcion: string;
  orden: number | null;
  activo: boolean | null;
  catalogo_padre_id?: number | null;
  catalogo_padre_nombre?: string | null;
  catalogo_padre_tipo_catalogo_id?: number | null;
  extra?: unknown;
  tipo_catalogo_nombre?: string | null;
};
