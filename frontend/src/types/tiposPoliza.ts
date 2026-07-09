export interface TipoPoliza {
  id: number;
  empresa_id: number;
  identificador: string;
  poliza_inicial: number;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
}

export type TipoPolizaInput = {
  identificador: string;
  poliza_inicial: number;
  activo?: boolean;
};
