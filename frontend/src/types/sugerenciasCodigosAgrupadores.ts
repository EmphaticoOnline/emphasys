export type NivelConfianza = 'alta' | 'media' | 'baja';

export interface SugerenciaCodigoAgrupador {
  cuenta_id: number;
  cuenta: string;
  descripcion: string;
  codigo_actual: string | null;
  codigo_sugerido: string;
  descripcion_sugerida: string;
  confianza: NivelConfianza;
  motivo: string;
  reemplaza_invalido: boolean;
}
