export type ImpuestoCatalogo = {
  id: string;
  nombre: string;
  tipo: 'traslado' | 'retencion' | string;
  tasa: number;
};

export type EmpresaImpuestoDefault = {
  id: number;
  empresa_id: number;
  impuesto_id: string;
  orden: number | null;
  impuesto?: ImpuestoCatalogo | null;
};
