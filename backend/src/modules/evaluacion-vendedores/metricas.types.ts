export const CORTE_DATOS_CONFIABLES = '2026-09-15T21:55:41.716Z';

export type OrigenRespuestaHumana = 'manual' | 'plantilla_manual';

export type MetricaBloqueRespondido = {
  conversacion_id: number;
  contacto_id: number;
  fecha_inicio_bloque: string;
  fecha_respuesta: string;
  tiempo_total_segundos: number;
  tiempo_laboral_segundos: number;
  responsable_inicio_contacto_id: number | null;
  responsabilidad_inicio_id: number | null;
  autor_respuesta_usuario_id: number;
  autor_respuesta_vendedor_contacto_id: number;
  responsabilidad_respuesta_id: number;
  respuesta_por_tercero: boolean;
  reasignado_durante_espera: boolean;
  origen_respuesta: OrigenRespuestaHumana;
  es_primera_respuesta_conversacion: boolean;
  primera_respuesta_elegible_para_kpi: boolean;
};

export type MetricaBloquePendiente = {
  conversacion_id: number;
  contacto_id: number;
  fecha_inicio_bloque: string;
  tiempo_total_actual: number;
  tiempo_laboral_actual: number;
  responsable_vigente_contacto_id: number | null;
  responsabilidad_vigente_id: number | null;
  reasignado_desde_inicio: boolean;
};

export type ResumenVendedor = {
  vendedor_contacto_id: number;
  respuestas_humanas: number;
  respuestas_validas_para_kpi: number;
  primeras_respuestas_elegibles: number;
  respuestas_por_tercero: number;
  conversaciones_atendidas: number;
  mensajes_manual: number;
  mensajes_plantilla_manual: number;
  tiempo_promedio_primera_respuesta_laboral: number | null;
  tiempo_promedio_respuesta_laboral: number | null;
  conversaciones_pendientes_respuesta: number;
};
