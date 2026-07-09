export type NivelValidacionEContabilidad = 'error' | 'advertencia';

export interface SeccionValidacionEContabilidad {
  clave: string;
  titulo: string;
  nivel: NivelValidacionEContabilidad;
  total: number;
  items: Record<string, unknown>[];
}

export interface ResumenValidacionEContabilidad {
  errores: number;
  advertencias: number;
  cuentas_revisadas: number;
  polizas_revisadas: number;
}

export interface ValidacionEContabilidadResultado {
  ok: boolean;
  ejercicio: number;
  periodo: number;
  resumen: ResumenValidacionEContabilidad;
  secciones: SeccionValidacionEContabilidad[];
}
