export type TipoEnvioBalanza = 'N' | 'C';

export interface ErrorBalanzaXml {
  tipo: string;
  cuenta?: string;
  descripcion?: string;
  motivo: string;
}

export interface AdvertenciaBalanzaXml {
  tipo: string;
  cuenta?: string;
  descripcion?: string;
  motivo: string;
}

export interface CuentaBalanzaXml {
  cuenta_id: number;
  num_cta: string;
  descripcion: string;
  saldo_ini: number;
  debe: number;
  haber: number;
  saldo_fin: number;
  naturaleza: 'D' | 'A' | null;
  naturaleza_descripcion: string | null;
}

export interface BalanzaComprobacionXmlResultado {
  ok: boolean;
  empresa: { rfc: string; razon_social: string };
  ejercicio: number;
  periodo: number;
  tipo_envio: TipoEnvioBalanza;
  fecha_modificacion: string | null;
  resumen: {
    cuentas: number;
    errores: number;
    advertencias: number;
    total_debe: number;
    total_haber: number;
    diferencia: number;
  };
  cuentas: CuentaBalanzaXml[];
  errores: ErrorBalanzaXml[];
  advertencias: AdvertenciaBalanzaXml[];
}
