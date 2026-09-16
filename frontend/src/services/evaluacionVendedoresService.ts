import { apiFetch } from './apiFetch';

export type PeriodoMetricas = { desde: string; hasta: string; corte_confiable: string };
export type VendedorMetrica = { vendedor_contacto_id: number; nombre: string | null; respuestas_humanas: number; respuestas_validas_para_kpi: number; primeras_respuestas_elegibles: number; conversaciones_atendidas: number; mensajes_manual: number; mensajes_plantilla_manual: number; tiempo_promedio_respuesta_laboral: number | null; tiempo_promedio_primera_respuesta_laboral: number | null; conversaciones_pendientes_respuesta: number; respuestas_por_tercero: number };
export type MetricasResponse = { periodo: PeriodoMetricas; vendedores: VendedorMetrica[] };
export type BloqueRespondido = { conversacion_id: number; contacto_id: number; fecha_inicio_bloque: string; fecha_respuesta: string; tiempo_total_segundos: number; tiempo_laboral_segundos: number; responsable_inicio_contacto_id: number | null; responsabilidad_inicio_id: number | null; autor_respuesta_usuario_id: number; autor_respuesta_vendedor_contacto_id: number; responsabilidad_respuesta_id: number; respuesta_por_tercero: boolean; reasignado_durante_espera: boolean; origen_respuesta: string; primera_respuesta_elegible_para_kpi: boolean };
export type BloquePendiente = { conversacion_id: number; contacto_id: number; fecha_inicio_bloque: string; tiempo_total_actual: number; tiempo_laboral_actual: number; responsable_vigente_contacto_id: number | null; responsabilidad_vigente_id: number | null; reasignado_desde_inicio: boolean };
export type BloquesResponse = { periodo: PeriodoMetricas; bloques_respondidos: BloqueRespondido[]; bloques_pendientes: BloquePendiente[] };

const params = (desde: string, hasta: string, vendedorContactoId?: number, estado?: 'respondido' | 'pendiente') => {
  const query = new URLSearchParams({ desde, hasta });
  if (vendedorContactoId) query.set('vendedor_contacto_id', String(vendedorContactoId));
  if (estado) query.set('estado', estado);
  return query.toString();
};

export const obtenerMetricas = (desde: string, hasta: string) => apiFetch<MetricasResponse>(`/api/evaluacion-vendedores/metricas?${params(desde, hasta)}`);
export const obtenerBloques = (desde: string, hasta: string, vendedorContactoId: number, estado?: 'respondido' | 'pendiente') => apiFetch<BloquesResponse>(`/api/evaluacion-vendedores/bloques?${params(desde, hasta, vendedorContactoId, estado)}`);
