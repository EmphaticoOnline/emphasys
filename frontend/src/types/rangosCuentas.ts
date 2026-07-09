export interface RangoCuenta {
  empresa_id: number;
  id: number;
  limite_superior: number;
  naturaleza_saldo: 'D' | 'A';
  descripcion: string;
  rango: string | null;
  grupo: string | null;
  subgrupo: string | null;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
}

export type RangoCuentaNuevoInput = {
  limite_superior: number;
  naturaleza_saldo: 'D' | 'A';
  descripcion: string;
  grupo: string;
  subgrupo?: string | null;
  activo?: boolean;
};

export type RangoCuentaEdicionInput = {
  limite_superior: number;
  naturaleza_saldo: 'D' | 'A';
  descripcion: string;
  grupo: string;
  subgrupo?: string | null;
  activo?: boolean;
};

export const GRUPOS_RANGO_CUENTA = [
  'Activo Circulante',
  'Activo Fijo',
  'Activo Diferido',
  'Pasivo Corto Plazo',
  'Pasivo Largo Plazo',
  'Pasivo Diferido',
  'Capital Contable',
  'Ingresos',
  'Egresos',
  'Orden',
] as const;

const GRUPOS_DE_RESULTADOS = ['Ingresos', 'Egresos'];

export const SUBGRUPOS_RESULTADOS = [
  'Ventas',
  'Rebajas, Bonificaciones y Dev. sobre Vtas',
  'Costo de Ventas',
  'Gastos de Administración',
  'Gastos de Venta',
  'Gastos Financieros',
  'Impuestos',
] as const;

export const SUBGRUPOS_NO_RESULTADOS = ['Sistema Financiero', 'Otros Créditos/Deudas', 'Ninguno'] as const;

export function subgruposValidosParaGrupo(grupo: string): readonly string[] {
  return GRUPOS_DE_RESULTADOS.includes(grupo) ? SUBGRUPOS_RESULTADOS : SUBGRUPOS_NO_RESULTADOS;
}

export const NATURALEZA_SALDO_LABEL: Record<'D' | 'A', string> = {
  D: 'Deudora',
  A: 'Acreedora',
};
