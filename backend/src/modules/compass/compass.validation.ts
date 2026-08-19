import {
  EXPECTATIVAS_ATENCION,
  FRENTE_CATEGORIAS,
  FRENTE_ESTADOS,
  INTENCION_PRIORIDADES,
  TAREA_ESTADOS,
  ACTIVIDAD_ESTADOS,
  ACTIVIDAD_CIERRE_ESTADOS,
  type FrenteInput,
  type FrentePatch,
  type IntencionSemanalInput,
  type TareaInput, type TareaPatch, type TareaFilters,
  type ActividadInput, type ActividadPatch, type ActividadFilters,
  type CierreActividadInput, type DerivadaActividadInput,
  CAPTURA_ESTADOS, type CapturaEstado, type ProcesarCapturaInput,
  type IdeaInput, type IdeaPatch, type ConvertirIdeaInput, type DecisionInput, type DecisionPatch, type RevisionSemanalInput,
} from './compass.types';

export class CompassValidationError extends Error {}

function requiredText(value: unknown, field: string, maxLength?: number): string {
  if (typeof value !== 'string' || !value.trim()) throw new CompassValidationError(`${field} es obligatorio`);
  const text = value.trim();
  if (maxLength && text.length > maxLength) throw new CompassValidationError(`${field} no puede exceder ${maxLength} caracteres`);
  return text;
}

function optionalNullableText(value: unknown, field: string): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new CompassValidationError(`${field} debe ser texto`);
  return value.trim() || null;
}

function nullableId(value: unknown, field: string): number | null {
  if (value == null || value === '') return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new CompassValidationError(`${field} inválido`);
  return id;
}

function dateOnly(value: unknown, field: string): string | null {
  if (value == null || value === '') return null;
  const text = String(value);
  const date = new Date(`${text}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== text) {
    throw new CompassValidationError(`${field} debe usar una fecha válida YYYY-MM-DD`);
  }
  return text;
}

function timestamp(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim() || Number.isNaN(Date.parse(value)) || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    throw new CompassValidationError(`${field} debe ser una fecha y hora ISO con Z u offset`);
  }
  return new Date(value).toISOString();
}

function booleanValue(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new CompassValidationError(`${field} debe ser booleano`);
  return value;
}

function enumValue<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new CompassValidationError(`${field} inválido`);
  }
  return value as T;
}

export function parseFrenteCreate(body: unknown): FrenteInput {
  const input = (body ?? {}) as Record<string, unknown>;
  return {
    nombre: requiredText(input.nombre, 'nombre', 200),
    proposito: requiredText(input.proposito, 'proposito'),
    categoria: enumValue(input.categoria, 'categoria', FRENTE_CATEGORIAS),
  };
}

export function parseFrentePatch(body: unknown): FrentePatch {
  const input = (body ?? {}) as Record<string, unknown>;
  const allowed = ['nombre', 'proposito', 'categoria', 'estado'];
  const supplied = allowed.filter((key) => Object.prototype.hasOwnProperty.call(input, key));
  if (!supplied.length) throw new CompassValidationError('Debes enviar al menos un campo modificable');

  const patch: FrentePatch = {};
  if (supplied.includes('nombre')) patch.nombre = requiredText(input.nombre, 'nombre', 200);
  if (supplied.includes('proposito')) patch.proposito = requiredText(input.proposito, 'proposito');
  if (supplied.includes('categoria')) patch.categoria = enumValue(input.categoria, 'categoria', FRENTE_CATEGORIAS);
  if (supplied.includes('estado')) patch.estado = enumValue(input.estado, 'estado', FRENTE_ESTADOS);
  return patch;
}

export function parseEstados(value: unknown): string[] {
  if (value == null || value === '') return ['activo'];
  const estados = String(value).split(',').map((item) => item.trim()).filter(Boolean);
  if (!estados.length || estados.some((item) => !FRENTE_ESTADOS.includes(item as any))) {
    throw new CompassValidationError('estado inválido');
  }
  return [...new Set(estados)];
}

export function parsePositiveId(value: unknown): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new CompassValidationError('id inválido');
  return id;
}

export function parseIntencionSemanal(body: unknown): IntencionSemanalInput {
  const input = (body ?? {}) as Record<string, unknown>;
  const semanaInicio = requiredText(input.semana_inicio, 'semana_inicio');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(semanaInicio)) throw new CompassValidationError('semana_inicio debe usar formato YYYY-MM-DD');
  const date = new Date(`${semanaInicio}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== semanaInicio || date.getUTCDay() !== 1) {
    throw new CompassValidationError('semana_inicio debe ser una fecha válida de lunes');
  }

  const hasHoras = input.horas_objetivo !== undefined && input.horas_objetivo !== null && input.horas_objetivo !== '';
  const hasExpectativa = input.expectativa_atencion !== undefined && input.expectativa_atencion !== null && input.expectativa_atencion !== '';
  if (hasHoras === hasExpectativa) {
    throw new CompassValidationError('Debes indicar horas_objetivo o expectativa_atencion, pero no ambas');
  }

  let horas: number | null = null;
  if (hasHoras) {
    horas = Number(input.horas_objetivo);
    if (!Number.isFinite(horas) || horas <= 0 || horas >= 10000 || Math.round(horas * 100) !== horas * 100) {
      throw new CompassValidationError('horas_objetivo debe ser mayor a cero y tener máximo dos decimales');
    }
  }

  return {
    semana_inicio: semanaInicio,
    prioridad: enumValue(input.prioridad, 'prioridad', INTENCION_PRIORIDADES),
    horas_objetivo: horas,
    expectativa_atencion: hasExpectativa
      ? enumValue(input.expectativa_atencion, 'expectativa_atencion', EXPECTATIVAS_ATENCION)
      : null,
    comentario: optionalNullableText(input.comentario, 'comentario'),
  };
}

export function parseTareaCreate(body: unknown): TareaInput {
  const input = (body ?? {}) as Record<string, unknown>;
  const siguiente = input.es_siguiente_accion == null ? false : booleanValue(input.es_siguiente_accion, 'es_siguiente_accion');
  const frenteId = nullableId(input.frente_id, 'frente_id');
  if (siguiente && !frenteId) throw new CompassValidationError('Una siguiente acción debe pertenecer a un Frente');
  return { titulo: requiredText(input.titulo, 'titulo', 300), frente_id: frenteId,
    fecha_limite: dateOnly(input.fecha_limite, 'fecha_limite'),
    prioridad_operativa: input.prioridad_operativa == null || input.prioridad_operativa === '' ? null : enumValue(input.prioridad_operativa, 'prioridad_operativa', INTENCION_PRIORIDADES),
    es_siguiente_accion: siguiente };
}

export function parseTareaPatch(body: unknown): TareaPatch {
  const input = (body ?? {}) as Record<string, unknown>;
  const allowed = ['titulo', 'frente_id', 'fecha_limite', 'prioridad_operativa', 'estado', 'es_siguiente_accion'];
  const supplied = allowed.filter((key) => Object.prototype.hasOwnProperty.call(input, key));
  if (!supplied.length) throw new CompassValidationError('Debes enviar al menos un campo modificable');
  const patch: TareaPatch = {};
  if (supplied.includes('titulo')) patch.titulo = requiredText(input.titulo, 'titulo', 300);
  if (supplied.includes('frente_id')) patch.frente_id = nullableId(input.frente_id, 'frente_id');
  if (supplied.includes('fecha_limite')) patch.fecha_limite = dateOnly(input.fecha_limite, 'fecha_limite');
  if (supplied.includes('prioridad_operativa')) patch.prioridad_operativa = input.prioridad_operativa == null || input.prioridad_operativa === '' ? null : enumValue(input.prioridad_operativa, 'prioridad_operativa', INTENCION_PRIORIDADES);
  if (supplied.includes('estado')) patch.estado = enumValue(input.estado, 'estado', TAREA_ESTADOS);
  if (supplied.includes('es_siguiente_accion')) patch.es_siguiente_accion = booleanValue(input.es_siguiente_accion, 'es_siguiente_accion');
  return patch;
}

export function parseTareaFilters(query: Record<string, unknown>): TareaFilters {
  const filters: TareaFilters = {};
  if (query.frente_id != null) filters.frenteId = parsePositiveId(query.frente_id);
  if (query.estado != null && query.estado !== '') filters.estado = enumValue(query.estado, 'estado', TAREA_ESTADOS);
  if (query.pendientes != null) filters.pendientes = ['1', 'true'].includes(String(query.pendientes).toLowerCase());
  return filters;
}

function validateInterval(start: string, end: string) {
  if (Date.parse(end) <= Date.parse(start)) throw new CompassValidationError('fin_programado debe ser posterior a inicio_programado');
}

export function parseActividadCreate(body: unknown): ActividadInput {
  const input = (body ?? {}) as Record<string, unknown>;
  const start = timestamp(input.inicio_programado, 'inicio_programado');
  const end = timestamp(input.fin_programado, 'fin_programado'); validateInterval(start, end);
  return { titulo: requiredText(input.titulo, 'titulo', 300), frente_id: nullableId(input.frente_id, 'frente_id'),
    tarea_id: nullableId(input.tarea_id, 'tarea_id'), inicio_programado: start, fin_programado: end };
}

export function parseActividadPatch(body: unknown): ActividadPatch {
  const input = (body ?? {}) as Record<string, unknown>;
  const allowed = ['titulo', 'frente_id', 'tarea_id', 'inicio_programado', 'fin_programado'];
  const supplied = allowed.filter((key) => Object.prototype.hasOwnProperty.call(input, key));
  if (!supplied.length) throw new CompassValidationError('Debes enviar al menos un campo modificable');
  const patch: ActividadPatch = {};
  if (supplied.includes('titulo')) patch.titulo = requiredText(input.titulo, 'titulo', 300);
  if (supplied.includes('frente_id')) patch.frente_id = nullableId(input.frente_id, 'frente_id');
  if (supplied.includes('tarea_id')) patch.tarea_id = nullableId(input.tarea_id, 'tarea_id');
  if (supplied.includes('inicio_programado')) patch.inicio_programado = timestamp(input.inicio_programado, 'inicio_programado');
  if (supplied.includes('fin_programado')) patch.fin_programado = timestamp(input.fin_programado, 'fin_programado');
  return patch;
}

export function parseActividadFilters(query: Record<string, unknown>): ActividadFilters {
  const filters: ActividadFilters = {};
  if (query.fecha_inicio != null) filters.fechaInicio = timestamp(query.fecha_inicio, 'fecha_inicio');
  if (query.fecha_fin != null) filters.fechaFin = timestamp(query.fecha_fin, 'fecha_fin');
  if (filters.fechaInicio && filters.fechaFin) validateInterval(filters.fechaInicio, filters.fechaFin);
  if (query.frente_id != null) filters.frenteId = parsePositiveId(query.frente_id);
  if (query.tarea_id != null) filters.tareaId = parsePositiveId(query.tarea_id);
  if (query.estado != null && query.estado !== '') filters.estado = enumValue(query.estado, 'estado', ACTIVIDAD_ESTADOS);
  return filters;
}

export function parseCierreActividad(body: unknown): CierreActividadInput {
  const input = (body ?? {}) as Record<string, unknown>;
  const estado = enumValue(input.estado, 'estado', ACTIVIDAD_CIERRE_ESTADOS);
  const usesMinutes = estado === 'realizada' || estado === 'parcial';
  let minutes: number | null = null;
  if (usesMinutes) {
    minutes = Number(input.minutos_efectivos);
    if (!Number.isInteger(minutes) || minutes < 0) throw new CompassValidationError('minutos_efectivos debe ser un entero mayor o igual a cero');
  } else if (input.minutos_efectivos != null) throw new CompassValidationError('minutos_efectivos sólo aplica a actividades realizadas o parciales');
  return { estado, minutos_efectivos: minutes, resultado: optionalNullableText(input.resultado, 'resultado') };
}

export function parseDerivadaActividad(body: unknown): DerivadaActividadInput {
  const input = (body ?? {}) as Record<string, unknown>;
  const start = timestamp(input.nuevo_inicio, 'nuevo_inicio'); const end = timestamp(input.nuevo_fin, 'nuevo_fin'); validateInterval(start, end);
  return { nuevo_inicio: start, nuevo_fin: end, titulo: optionalNullableText(input.titulo, 'titulo') };
}

export function parseCapturaEstado(value: unknown): CapturaEstado {
  if (value == null || value === '') return 'pendiente';
  return enumValue(value, 'estado', CAPTURA_ESTADOS);
}

export function parseCapturaCreate(body: unknown) {
  const input = (body ?? {}) as Record<string, unknown>;
  return { texto: requiredText(input.texto, 'texto') };
}

export function parseCapturaPatch(body: unknown) {
  const input = (body ?? {}) as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(input, 'estado')) throw new CompassValidationError('estado es obligatorio');
  const estado = enumValue(input.estado, 'estado', ['pendiente', 'descartada'] as const);
  return { estado };
}

export function parseProcesarCaptura(body: unknown): ProcesarCapturaInput {
  const input = (body ?? {}) as Record<string, unknown>;
  const destino = enumValue(input.destino, 'destino', ['tarea', 'actividad', 'frente', 'idea', 'decision', 'descartar'] as const);
  if (destino === 'tarea') return { destino, frente_id: nullableId(input.frente_id, 'frente_id') };
  if (destino === 'actividad') {
    const inicio = timestamp(input.inicio_programado, 'inicio_programado');
    const fin = timestamp(input.fin_programado, 'fin_programado'); validateInterval(inicio, fin);
    return { destino, frente_id: nullableId(input.frente_id, 'frente_id'), tarea_id: nullableId(input.tarea_id, 'tarea_id'), inicio_programado: inicio, fin_programado: fin };
  }
  if (destino === 'frente') return { destino, nombre: requiredText(input.nombre, 'nombre', 200), proposito: optionalNullableText(input.proposito, 'proposito') ?? String(input.nombre).trim(), categoria: input.categoria == null || input.categoria === '' ? 'personal' : enumValue(input.categoria, 'categoria', FRENTE_CATEGORIAS) };
  if (destino === 'idea') return { destino, frente_id: nullableId(input.frente_id, 'frente_id') };
  if (destino === 'decision') return { destino, frente_id: nullableId(input.frente_id, 'frente_id'), descripcion: optionalNullableText(input.descripcion, 'descripcion'), motivo: optionalNullableText(input.motivo, 'motivo'), fecha_decision: dateOnly(input.fecha_decision ?? new Date().toISOString().slice(0,10), 'fecha_decision')! };
  return { destino };
}

export function parseIdeaCreate(body:unknown):IdeaInput { const input=(body??{}) as Record<string,unknown>; return { titulo:requiredText(input.titulo??input.texto,'titulo',300),descripcion:optionalNullableText(input.descripcion,'descripcion'),frente_id:nullableId(input.frente_id,'frente_id') }; }
export function parseIdeaPatch(body:unknown):IdeaPatch { const input=(body??{}) as Record<string,unknown>;const supplied=['titulo','descripcion','frente_id','estado'].filter(k=>Object.prototype.hasOwnProperty.call(input,k));if(!supplied.length)throw new CompassValidationError('Debes enviar al menos un campo modificable');const out:IdeaPatch={};if(supplied.includes('titulo'))out.titulo=requiredText(input.titulo,'titulo',300);if(supplied.includes('descripcion'))out.descripcion=optionalNullableText(input.descripcion,'descripcion');if(supplied.includes('frente_id'))out.frente_id=nullableId(input.frente_id,'frente_id');if(supplied.includes('estado'))out.estado=enumValue(input.estado,'estado',['activa','archivada'] as const);return out; }
export function parseConvertirIdea(body:unknown):ConvertirIdeaInput { const input=(body??{}) as Record<string,unknown>;const destino=enumValue(input.destino,'destino',['frente','tarea','actividad'] as const);if(destino==='tarea')return {destino,frente_id:nullableId(input.frente_id,'frente_id')};if(destino==='actividad'){const inicio=timestamp(input.inicio_programado,'inicio_programado');const fin=timestamp(input.fin_programado,'fin_programado');validateInterval(inicio,fin);return {destino,frente_id:nullableId(input.frente_id,'frente_id'),tarea_id:nullableId(input.tarea_id,'tarea_id'),inicio_programado:inicio,fin_programado:fin};}return {destino,nombre:requiredText(input.nombre,'nombre',200),proposito:optionalNullableText(input.proposito,'proposito')??String(input.nombre).trim(),categoria:input.categoria==null?'personal':enumValue(input.categoria,'categoria',FRENTE_CATEGORIAS)}; }
export function parseDecisionCreate(body:unknown):DecisionInput { const input=(body??{}) as Record<string,unknown>;return {titulo:requiredText(input.titulo,'titulo',300),descripcion:optionalNullableText(input.descripcion,'descripcion'),motivo:optionalNullableText(input.motivo,'motivo'),fecha_decision:dateOnly(input.fecha??input.fecha_decision??new Date().toISOString().slice(0,10),'fecha')!,frente_id:nullableId(input.frente_id,'frente_id')}; }
export function parseDecisionPatch(body:unknown):DecisionPatch { const input=(body??{}) as Record<string,unknown>;const supplied=['titulo','descripcion','motivo','fecha','fecha_decision','frente_id'].filter(k=>Object.prototype.hasOwnProperty.call(input,k));if(!supplied.length)throw new CompassValidationError('Debes enviar al menos un campo modificable');const out:DecisionPatch={};if(supplied.includes('titulo'))out.titulo=requiredText(input.titulo,'titulo',300);if(supplied.includes('descripcion'))out.descripcion=optionalNullableText(input.descripcion,'descripcion');if(supplied.includes('motivo'))out.motivo=optionalNullableText(input.motivo,'motivo');if(supplied.includes('fecha')||supplied.includes('fecha_decision'))out.fecha_decision=dateOnly(input.fecha??input.fecha_decision,'fecha')!;if(supplied.includes('frente_id'))out.frente_id=nullableId(input.frente_id,'frente_id');return out; }

export function parseRevisionSemanal(body:unknown):RevisionSemanalInput {
  const input=(body??{}) as Record<string,unknown>; const semana=requiredText(input.semana_inicio,'semana_inicio');
  const date=dateOnly(semana,'semana_inicio');if(!date||new Date(`${date}T00:00:00Z`).getUTCDay()!==1)throw new CompassValidationError('semana_inicio debe ser lunes');
  if(!Array.isArray(input.frentes)||!Array.isArray(input.proximas_intenciones))throw new CompassValidationError('frentes y proximas_intenciones deben ser arreglos');
  const congruencias=['congruente','en_riesgo','descuidado','sobreatendido'] as const;
  const frentes=input.frentes.map((raw:any)=>({frente_id:parsePositiveId(raw?.frente_id),congruencia_confirmada:raw?.congruencia_confirmada==null?null:enumValue(raw.congruencia_confirmada,'congruencia_confirmada',congruencias),que_ocurrio:optionalNullableText(raw?.que_ocurrio,'que_ocurrio'),que_bloqueo:optionalNullableText(raw?.que_bloqueo,'que_bloqueo'),que_aprendi:optionalNullableText(raw?.que_aprendi,'que_aprendi'),que_cambiare:optionalNullableText(raw?.que_cambiare,'que_cambiare')}));
  const expected=new Date(`${date}T00:00:00Z`);expected.setUTCDate(expected.getUTCDate()+7);const next=expected.toISOString().slice(0,10);
  const proximas_intenciones=input.proximas_intenciones.map((raw:any)=>{const parsed=parseIntencionSemanal(raw);if(parsed.semana_inicio!==next)throw new CompassValidationError('Las intenciones próximas deben corresponder a la semana siguiente');return {frente_id:parsePositiveId(raw?.frente_id),...parsed};});
  return {semana_inicio:date,atencion_esperada:requiredText(input.atencion_esperada,'atencion_esperada'),frentes_descuidados:requiredText(input.frentes_descuidados,'frentes_descuidados'),aprendizaje_principal:requiredText(input.aprendizaje_principal,'aprendizaje_principal'),ajuste_general:requiredText(input.ajuste_general,'ajuste_general'),frentes,proximas_intenciones};
}
export function parseSemanaInicio(value:unknown){const week=dateOnly(value,'semana_inicio');if(!week||new Date(`${week}T00:00:00Z`).getUTCDay()!==1)throw new CompassValidationError('semana_inicio debe ser lunes');return week;}
