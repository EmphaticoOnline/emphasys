import { calcularSegundosLaborales } from './tiempo-laboral.service';
import { cargarDatosMetrica, type MensajeMetrica, type ResponsabilidadMetrica } from './metricas.repository';
import { CORTE_DATOS_CONFIABLES, type MetricaBloquePendiente, type MetricaBloqueRespondido, type OrigenRespuestaHumana, type ResumenVendedor } from './metricas.types';

const humana = (m: MensajeMetrica) => m.tipo_mensaje === 'saliente' && (m.status === 'sent' || m.status === 'delivered' || m.status === 'read') && (m.origen_envio === 'manual' || m.origen_envio === 'plantilla_manual') && m.autor_usuario_id !== null && m.autor_vendedor_contacto_id !== null && m.responsabilidad_contacto_id !== null;
const instante = (m: MensajeMetrica) => new Date(m.fecha);
const responsabilidadEn = (items: ResponsabilidadMetrica[], contactoId: number, at: Date) => items.filter((r) => r.contacto_id === contactoId && new Date(r.vigente_desde) <= at && (r.vigente_hasta === null || at < new Date(r.vigente_hasta))).sort((a,b) => new Date(b.vigente_desde).getTime() - new Date(a.vigente_desde).getTime())[0] ?? null;
const huboReasignacion = (items: ResponsabilidadMetrica[], contactoId: number, inicio: Date, fin: Date) => items.some((r) => r.contacto_id === contactoId && new Date(r.vigente_desde) > inicio && new Date(r.vigente_desde) <= fin);

export async function calcularMetricasVendedores(corte = CORTE_DATOS_CONFIABLES, empresaId?: number, periodo?: { desde?: string; hasta?: string }) {
  const data = await cargarDatosMetrica(corte, empresaId); const empresas = new Map(data.empresas.map((e) => [e.id, e])); const horarios = new Map<number, any[]>(); const excepciones = new Map<number, any[]>();
  data.horarios.forEach((h) => horarios.set(h.empresa_id, [...(horarios.get(h.empresa_id) ?? []), h])); data.excepciones.forEach((x) => excepciones.set(x.empresa_id, [...(excepciones.get(x.empresa_id) ?? []), x]));
  const respondidos: MetricaBloqueRespondido[] = []; const pendientes: MetricaBloquePendiente[] = [];
  const mensajesMetrica = data.mensajes.filter((m) => !m.contacto_id_inconsistente && m.contacto_id !== null);
  const porConversacion = new Map<string, MensajeMetrica[]>(); mensajesMetrica.forEach((m) => { const key = `${m.empresa_id}:${m.conversacion_id}:${m.contacto_id}`; porConversacion.set(key, [...(porConversacion.get(key) ?? []), m]); });
  for (const mensajes of porConversacion.values()) {
    let bloque: MensajeMetrica[] = [];
    const cerrar = (respuesta?: MensajeMetrica) => {
      if (!bloque.length) return;
      const inicio = instante(bloque[0]); const empresa = empresas.get(bloque[0].empresa_id);
      if (!empresa) return;
      const respInicio = responsabilidadEn(data.responsabilidades, bloque[0].contacto_id, inicio); const fin = respuesta ? instante(respuesta) : new Date(); const reasignado = huboReasignacion(data.responsabilidades, bloque[0].contacto_id, inicio, fin);
      if (respuesta) {
        const total = Math.max(0, Math.floor((fin.getTime() - inicio.getTime()) / 1000)); const labor = calcularSegundosLaborales(inicio, fin, { zona_horaria: empresa.zona_horaria, horarios: horarios.get(empresa.id) ?? [], excepciones: excepciones.get(empresa.id) ?? [] });
        respondidos.push({ conversacion_id: respuesta.conversacion_id, contacto_id: respuesta.contacto_id, fecha_inicio_bloque: inicio.toISOString(), fecha_respuesta: fin.toISOString(), tiempo_total_segundos: total, tiempo_laboral_segundos: labor, responsable_inicio_contacto_id: respInicio?.vendedor_contacto_id ?? null, responsabilidad_inicio_id: respInicio?.id ?? null, autor_respuesta_usuario_id: respuesta.autor_usuario_id!, autor_respuesta_vendedor_contacto_id: respuesta.autor_vendedor_contacto_id!, responsabilidad_respuesta_id: respuesta.responsabilidad_contacto_id!, respuesta_por_tercero: respInicio !== null && respInicio.vendedor_contacto_id !== respuesta.autor_vendedor_contacto_id, reasignado_durante_espera: reasignado, origen_respuesta: respuesta.origen_envio as OrigenRespuestaHumana, es_primera_respuesta_conversacion: !bloque[0].previo_al_corte, primera_respuesta_elegible_para_kpi: !bloque[0].previo_al_corte && !reasignado });
      } else {
        pendientes.push({ conversacion_id: bloque[0].conversacion_id, contacto_id: bloque[0].contacto_id, fecha_inicio_bloque: inicio.toISOString(), tiempo_total_actual: Math.max(0, Math.floor((fin.getTime() - inicio.getTime()) / 1000)), tiempo_laboral_actual: calcularSegundosLaborales(inicio, fin, { zona_horaria: empresa.zona_horaria, horarios: horarios.get(empresa.id) ?? [], excepciones: excepciones.get(empresa.id) ?? [] }), responsable_vigente_contacto_id: responsabilidadEn(data.responsabilidades, bloque[0].contacto_id, fin)?.vendedor_contacto_id ?? null, responsabilidad_vigente_id: responsabilidadEn(data.responsabilidades, bloque[0].contacto_id, fin)?.id ?? null, reasignado_desde_inicio: reasignado });
      }
      bloque = [];
    };
    for (const m of mensajes) { if (m.tipo_mensaje === 'entrante') bloque.push(m); else if (humana(m)) cerrar(m); }
    cerrar();
  }
  const empresa = empresas.get(empresaId ?? data.empresas[0]?.id); const enPeriodo = (fecha: string) => { if (!periodo || !empresa?.zona_horaria) return true; const local = new Intl.DateTimeFormat('en-CA', { timeZone: empresa.zona_horaria, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(fecha)); return (!periodo.desde || local >= periodo.desde) && (!periodo.hasta || local <= periodo.hasta); };
  const respondidosPeriodo = respondidos.filter((r) => enPeriodo(r.fecha_inicio_bloque)); const pendientesPeriodo = pendientes.filter((p) => enPeriodo(p.fecha_inicio_bloque)); const mensajesPeriodo = mensajesMetrica.filter((m) => enPeriodo(m.fecha));
  return { corte, bloques_respondidos: respondidosPeriodo, bloques_pendientes: pendientesPeriodo, resumen_por_vendedor: resumir(respondidosPeriodo, pendientesPeriodo, mensajesPeriodo) };
}

function resumir(respondidos: MetricaBloqueRespondido[], pendientes: MetricaBloquePendiente[], mensajes: MensajeMetrica[]): ResumenVendedor[] {
  const map = new Map<number, ResumenVendedor>(); const conversaciones = new Map<number, Set<number>>(); const sum = new Map<number, { first: number; firstCount: number; all: number; allCount: number }>(); const get = (id: number) => map.get(id) ?? { vendedor_contacto_id: id, respuestas_humanas: 0, respuestas_validas_para_kpi: 0, primeras_respuestas_elegibles: 0, respuestas_por_tercero: 0, conversaciones_atendidas: 0, mensajes_manual: 0, mensajes_plantilla_manual: 0, tiempo_promedio_primera_respuesta_laboral: null, tiempo_promedio_respuesta_laboral: null, conversaciones_pendientes_respuesta: 0 };
  for (const m of mensajes.filter(humana)) { const x = get(m.autor_vendedor_contacto_id!); x.mensajes_manual += Number(m.origen_envio === 'manual'); x.mensajes_plantilla_manual += Number(m.origen_envio === 'plantilla_manual'); map.set(m.autor_vendedor_contacto_id!, x); }
  for (const r of respondidos) { const id = r.autor_respuesta_vendedor_contacto_id; const x = get(id); const totals = sum.get(id) ?? { first: 0, firstCount: 0, all: 0, allCount: 0 }; x.respuestas_humanas += 1; x.respuestas_por_tercero += Number(r.respuesta_por_tercero); const valida = !r.reasignado_durante_espera; x.respuestas_validas_para_kpi += Number(valida); x.primeras_respuestas_elegibles += Number(r.primera_respuesta_elegible_para_kpi); const set = conversaciones.get(id) ?? new Set<number>(); set.add(r.conversacion_id); conversaciones.set(id, set); x.conversaciones_atendidas = set.size; if (valida) { totals.all += r.tiempo_laboral_segundos; totals.allCount += 1; } if (r.primera_respuesta_elegible_para_kpi) { totals.first += r.tiempo_laboral_segundos; totals.firstCount += 1; } sum.set(id, totals); map.set(id, x); }
  for (const p of pendientes) if (p.responsable_vigente_contacto_id) { const x = get(p.responsable_vigente_contacto_id); x.conversaciones_pendientes_respuesta += 1; map.set(p.responsable_vigente_contacto_id, x); }
  return [...map.entries()].map(([id, value]) => { const totals = sum.get(id); return { ...value, tiempo_promedio_primera_respuesta_laboral: totals?.firstCount ? Math.floor(totals.first / totals.firstCount) : null, tiempo_promedio_respuesta_laboral: totals?.allCount ? Math.floor(totals.all / totals.allCount) : null }; });
}
