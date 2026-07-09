export interface ErrorCatalogoXml {
  tipo: string;
  cuenta?: string;
  descripcion?: string;
  motivo: string;
}

export interface AdvertenciaCatalogoXml {
  tipo: string;
  cuenta?: string;
  descripcion?: string;
  motivo: string;
}

export interface CuentaCatalogoXml {
  cuenta_id: number;
  num_cta: string;
  descripcion: string;
  cod_agrup: string | null;
  nivel: number;
  naturaleza: 'D' | 'A' | null;
  naturaleza_descripcion: string | null;
  sub_cta_de: string | null;
  afectable: boolean;
}

export interface CatalogoCuentasXmlResultado {
  ok: boolean;
  empresa: { rfc: string; razon_social: string };
  ejercicio: number;
  periodo: number;
  resumen: { cuentas: number; errores: number; advertencias: number };
  cuentas: CuentaCatalogoXml[];
  errores: ErrorCatalogoXml[];
  advertencias: AdvertenciaCatalogoXml[];
}
