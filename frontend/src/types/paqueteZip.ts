export type TipoEnvioBalanza = 'N' | 'C';
export type TipoSolicitudPolizas = 'AF' | 'FC' | 'DE' | 'CO';

export type ClaveArchivoPaquete = 'catalogo' | 'balanza' | 'polizas' | 'aux_folios' | 'aux_cuentas';

export interface DetalleProblemaArchivo {
  tipo: string;
  poliza?: string;
  cuenta?: string;
  descripcion?: string;
  motivo: string;
}

export interface ArchivoPaqueteZip {
  clave: ClaveArchivoPaquete;
  titulo: string;
  nombre: string;
  ok: boolean;
  errores: number;
  advertencias: number;
  detalle_errores: DetalleProblemaArchivo[];
  detalle_advertencias: DetalleProblemaArchivo[];
}

export interface PaqueteZipPreviewResultado {
  ok: boolean;
  empresa: { rfc: string; razon_social: string };
  ejercicio: number;
  periodo: number;
  resumen: {
    archivos_seleccionados: number;
    archivos_ok: number;
    archivos_con_error: number;
    errores: number;
    advertencias: number;
  };
  archivos: ArchivoPaqueteZip[];
}
