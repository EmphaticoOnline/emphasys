import { apiFetch } from './apiFetch';

export type FrenteCategoria = 'personal' | 'profesional';
export type FrenteEstado = 'activo' | 'pausado' | 'completado' | 'archivado';
export type IntencionPrioridad = 'alta' | 'media' | 'baja';
export type ExpectativaAtencion = 'sin_compromiso' | 'atender' | 'prioritario';
export type TareaEstado = 'pendiente' | 'en_curso' | 'completada' | 'cancelada';
export type ActividadEstado = 'programada' | 'realizada' | 'parcial' | 'no_realizada' | 'cancelada';

export type IntencionSemanal = {
  id: number;
  semana_inicio: string;
  prioridad: IntencionPrioridad;
  horas_objetivo: number | null;
  expectativa_atencion: ExpectativaAtencion | null;
  comentario: string | null;
};

export type Frente = {
  id: number;
  nombre: string;
  proposito: string;
  categoria: FrenteCategoria;
  estado: FrenteEstado;
  prioridad_semanal: IntencionPrioridad | null;
  horas_objetivo: number | null;
  expectativa_atencion: ExpectativaAtencion | null;
  siguiente_accion: { id: number; titulo: string } | null;
  intencion_semanal: IntencionSemanal | null;
};

export type FrenteCreate = Pick<Frente, 'nombre' | 'proposito' | 'categoria'>;
export type FrentePatch = Partial<Pick<Frente, 'nombre' | 'proposito' | 'categoria' | 'estado'>>;
export type IntencionSemanalUpsert = Omit<IntencionSemanal, 'id'>;

export type Tarea = {
  id: number; titulo: string; frente_id: number | null; frente_nombre: string | null;
  fecha_limite: string | null; prioridad_operativa: IntencionPrioridad | null;
  estado: TareaEstado; es_siguiente_accion: boolean; fecha_finalizacion: string | null;
  created_at: string; updated_at: string;
};
export type TareaCreate = Pick<Tarea, 'titulo' | 'frente_id' | 'fecha_limite' | 'prioridad_operativa' | 'es_siguiente_accion'>;
export type TareaPatch = Partial<Pick<Tarea, 'titulo' | 'frente_id' | 'fecha_limite' | 'prioridad_operativa' | 'estado' | 'es_siguiente_accion'>>;
export type TareaFilters = { frente_id?: number; estado?: TareaEstado; pendientes?: boolean };

export type Actividad = {
  id: number; titulo: string; frente_id: number | null; frente_nombre: string | null;
  tarea_id: number | null; tarea_titulo: string | null; actividad_origen_id: number | null;
  tipo_origen: 'reprogramacion' | 'continuacion' | null; inicio_programado: string;
  fin_programado: string; estado: ActividadEstado; minutos_efectivos: number | null;
  resultado: string | null; fecha_cierre: string | null; created_at: string; updated_at: string;
};
export type ActividadCreate = Pick<Actividad, 'titulo' | 'frente_id' | 'tarea_id' | 'inicio_programado' | 'fin_programado'>;
export type ActividadPatch = Partial<ActividadCreate>;
export type ActividadFilters = { fecha_inicio?: string; fecha_fin?: string; frente_id?: number; tarea_id?: number; estado?: ActividadEstado };
export type ActividadCierre = { estado: Exclude<ActividadEstado, 'programada'>; minutos_efectivos?: number | null; resultado?: string | null };
export type ActividadDerivada = { nuevo_inicio: string; nuevo_fin: string; titulo?: string };
export type CapturaEstado = 'pendiente' | 'procesada' | 'descartada';
export type Captura = { id:number; texto:string; estado:CapturaEstado; tipo_destino:'tarea'|'actividad'|'frente'|'idea'|'decision'|null; destino_id:number|null; captured_at:string; processed_at:string|null; created_at:string; updated_at:string };
export type ProcesarCaptura =
  | { destino:'tarea'; frente_id:number|null }
  | { destino:'actividad'; frente_id:number|null; tarea_id:number|null; inicio_programado:string; fin_programado:string }
  | { destino:'frente'; nombre:string; proposito?:string|null; categoria?:FrenteCategoria }
  | { destino:'idea'; frente_id:number|null }
  | { destino:'decision'; frente_id:number|null; descripcion?:string|null; motivo?:string|null; fecha_decision?:string }
  | { destino:'descartar' };
export type IdeaEstado='activa'|'archivada';
export type Idea={id:number;titulo:string;descripcion:string|null;frente_id:number|null;frente_nombre:string|null;estado:IdeaEstado;tipo_conversion:'frente'|'tarea'|'actividad'|null;conversion_id:number|null;fecha_archivo:string|null;created_at:string;updated_at:string};
export type IdeaCreate={titulo:string;descripcion?:string|null;frente_id?:number|null};
export type IdeaPatch=Partial<IdeaCreate&{estado:IdeaEstado}>;
export type ConvertirIdea=Extract<ProcesarCaptura,{destino:'tarea'|'actividad'|'frente'}>;
export type Decision={id:number;titulo:string;descripcion:string|null;motivo:string|null;fecha:string;frente_id:number|null;frente_nombre:string|null;created_at:string;updated_at:string};
export type DecisionCreate={titulo:string;descripcion?:string|null;motivo?:string|null;fecha?:string;frente_id?:number|null};
export type DecisionPatch=Partial<DecisionCreate>;
export type Congruencia='congruente'|'en_riesgo'|'descuidado'|'sobreatendido';
export type RevisionFrente={frente_id:number;nombre:string;intencion_semanal_id:number|null;prioridad_snapshot:IntencionPrioridad|null;horas_objetivo_snapshot:number|null;expectativa_atencion_snapshot:ExpectativaAtencion|null;horas_planificadas:number;horas_efectivas:number;horas_reservadas:number;congruencia_sugerida:Congruencia|null;congruencia_confirmada:Congruencia|null;que_ocurrio:string|null;que_bloqueo:string|null;que_aprendi:string|null;que_cambiare:string|null};
export type RevisionSemanal={revision:null|{id:number;semana_inicio:string;fecha_revision:string;atencion_esperada:string;frentes_descuidados:string;aprendizaje_principal:string;ajuste_general:string};semana_inicio:string;frentes:RevisionFrente[];historica:boolean};
export type RevisionSemanalHistorica={id:number;semana_inicio:string;fecha_revision:string};
export type RevisionSemanalListOptions={limit?:number;offset?:number};
export type RevisionSave={semana_inicio:string;atencion_esperada:string;frentes_descuidados:string;aprendizaje_principal:string;ajuste_general:string;frentes:Array<Pick<RevisionFrente,'frente_id'|'congruencia_confirmada'|'que_ocurrio'|'que_bloqueo'|'que_aprendi'|'que_cambiare'>>;proximas_intenciones:Array<IntencionSemanalUpsert&{frente_id:number}>};

export function listFrentes(estados: FrenteEstado[] = ['activo']) {
  const query = encodeURIComponent(estados.join(','));
  return apiFetch<Frente[]>(`/api/compass/frentes?estado=${query}`);
}

export function getFrente(id: number) {
  return apiFetch<Frente>(`/api/compass/frentes/${id}`);
}

export function createFrente(payload: FrenteCreate) {
  return apiFetch<Frente>('/api/compass/frentes', { method: 'POST', body: payload });
}

export function updateFrente(id: number, payload: FrentePatch) {
  return apiFetch<Frente>(`/api/compass/frentes/${id}`, { method: 'PATCH', body: payload });
}

export function saveIntencionSemanal(id: number, payload: IntencionSemanalUpsert) {
  return apiFetch<IntencionSemanal>(`/api/compass/frentes/${id}/intencion-semanal`, { method: 'PUT', body: payload });
}

function queryString(values: Record<string, string | number | boolean | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value !== undefined) params.set(key, String(value)); });
  const query = params.toString(); return query ? `?${query}` : '';
}
export const listTareas = (filters: TareaFilters = {}) => apiFetch<Tarea[]>(`/api/compass/tareas${queryString(filters)}`);
export const getTarea = (id: number) => apiFetch<Tarea>(`/api/compass/tareas/${id}`);
export const createTarea = (payload: TareaCreate) => apiFetch<Tarea>('/api/compass/tareas', { method: 'POST', body: payload });
export const updateTarea = (id: number, payload: TareaPatch) => apiFetch<Tarea>(`/api/compass/tareas/${id}`, { method: 'PATCH', body: payload });
export const listActividades = (filters: ActividadFilters = {}) => apiFetch<Actividad[]>(`/api/compass/actividades${queryString(filters)}`);
export const getActividad = (id: number) => apiFetch<Actividad>(`/api/compass/actividades/${id}`);
export const createActividad = (payload: ActividadCreate) => apiFetch<Actividad>('/api/compass/actividades', { method: 'POST', body: payload });
export const updateActividad = (id: number, payload: ActividadPatch) => apiFetch<Actividad>(`/api/compass/actividades/${id}`, { method: 'PATCH', body: payload });
export const deleteActividad = (id: number) => apiFetch<void>(`/api/compass/actividades/${id}`, { method: 'DELETE' });
export const closeActividad = (id: number, payload: ActividadCierre) => apiFetch<Actividad>(`/api/compass/actividades/${id}/cerrar`, { method: 'POST', body: payload });
export const rescheduleActividad = (id: number, payload: ActividadDerivada) => apiFetch<Actividad>(`/api/compass/actividades/${id}/reprogramar`, { method: 'POST', body: payload });
export const continueActividad = (id: number, payload: ActividadDerivada) => apiFetch<Actividad>(`/api/compass/actividades/${id}/continuar`, { method: 'POST', body: payload });
export const listCapturas = (estado: CapturaEstado = 'pendiente') => apiFetch<Captura[]>(`/api/compass/capturas?estado=${estado}`);
export const createCaptura = (texto: string) => apiFetch<Captura>('/api/compass/capturas', { method: 'POST', body: { texto } });
export const updateCaptura = (id: number, estado: 'pendiente'|'descartada') => apiFetch<Captura>(`/api/compass/capturas/${id}`, { method: 'PATCH', body: { estado } });
export const processCaptura = (id: number, payload: ProcesarCaptura) => apiFetch<Captura>(`/api/compass/capturas/${id}/procesar`, { method: 'POST', body: payload });
export const listIdeas=(estado?:IdeaEstado)=>apiFetch<Idea[]>(`/api/compass/ideas${estado?`?estado=${estado}`:''}`);
export const getIdea=(id:number)=>apiFetch<Idea>(`/api/compass/ideas/${id}`);
export const createIdea=(payload:IdeaCreate)=>apiFetch<Idea>('/api/compass/ideas',{method:'POST',body:payload});
export const updateIdea=(id:number,payload:IdeaPatch)=>apiFetch<Idea>(`/api/compass/ideas/${id}`,{method:'PATCH',body:payload});
export const convertIdea=(id:number,payload:ConvertirIdea)=>apiFetch<Idea>(`/api/compass/ideas/${id}/convertir`,{method:'POST',body:payload});
export const listDecisiones=()=>apiFetch<Decision[]>('/api/compass/decisiones');
export const getDecision=(id:number)=>apiFetch<Decision>(`/api/compass/decisiones/${id}`);
export const createDecision=(payload:DecisionCreate)=>apiFetch<Decision>('/api/compass/decisiones',{method:'POST',body:payload});
export const updateDecision=(id:number,payload:DecisionPatch)=>apiFetch<Decision>(`/api/compass/decisiones/${id}`,{method:'PATCH',body:payload});
export const listRevisionesSemanales=(options:RevisionSemanalListOptions={})=>apiFetch<RevisionSemanalHistorica[]>(`/api/compass/revisiones-semanales${queryString(options)}`);
export const getRevisionSemanal=(semana:string)=>apiFetch<RevisionSemanal>(`/api/compass/revisiones-semanales/${semana}`);
export const saveRevisionSemanal=(semana:string,payload:RevisionSave)=>apiFetch<RevisionSemanal>(`/api/compass/revisiones-semanales/${semana}`,{method:'PUT',body:payload});
