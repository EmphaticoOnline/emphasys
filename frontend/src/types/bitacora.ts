import type { ArchivoPaqueteZip } from './paqueteZip';

export interface ItemBitacoraPaquete {
  id: number;
  ejercicio: number;
  periodo: number;
  nombre_zip: string;
  archivos_incluidos: ArchivoPaqueteZip[];
  parametros: Record<string, unknown>;
  resumen: {
    archivos_seleccionados: number;
    archivos_ok: number;
    archivos_con_error: number;
    errores: number;
    advertencias: number;
  };
  hash_zip: string | null;
  hash_algoritmo: string | null;
  generado_por: number | null;
  generado_por_nombre: string | null;
  generado_en: string;
  observaciones: string | null;
}

export interface BitacoraPaquetesResultado {
  items: ItemBitacoraPaquete[];
}
