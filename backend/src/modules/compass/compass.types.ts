export const FRENTE_CATEGORIAS = ['personal', 'profesional'] as const;
export const FRENTE_ESTADOS = ['activo', 'pausado', 'completado', 'archivado'] as const;
export const INTENCION_PRIORIDADES = ['alta', 'media', 'baja'] as const;
export const EXPECTATIVAS_ATENCION = ['sin_compromiso', 'atender', 'prioritario'] as const;
export const TAREA_ESTADOS = ['pendiente', 'en_curso', 'completada', 'cancelada'] as const;
export const ACTIVIDAD_ESTADOS = ['programada', 'realizada', 'parcial', 'no_realizada', 'cancelada'] as const;
export const ACTIVIDAD_CIERRE_ESTADOS = ['realizada', 'parcial', 'no_realizada', 'cancelada'] as const;

export type FrenteCategoria = typeof FRENTE_CATEGORIAS[number];
export type FrenteEstado = typeof FRENTE_ESTADOS[number];
export type IntencionPrioridad = typeof INTENCION_PRIORIDADES[number];
export type ExpectativaAtencion = typeof EXPECTATIVAS_ATENCION[number];
export type TareaEstado = typeof TAREA_ESTADOS[number];
export type ActividadEstado = typeof ACTIVIDAD_ESTADOS[number];

export type CompassOwnerScope = { empresaId: number | null; usuarioId: number };

export type FrenteInput = {
  nombre: string;
  proposito: string;
  categoria: FrenteCategoria;
};

export type FrentePatch = Partial<FrenteInput> & { estado?: FrenteEstado };

export type IntencionSemanalInput = {
  semana_inicio: string;
  prioridad: IntencionPrioridad;
  horas_objetivo: number | null;
  expectativa_atencion: ExpectativaAtencion | null;
  comentario: string | null;
};

export type TareaInput = {
  titulo: string; frente_id: number | null; fecha_limite: string | null;
  prioridad_operativa: IntencionPrioridad | null; es_siguiente_accion: boolean;
};
export type TareaPatch = Partial<TareaInput & { estado: TareaEstado }>;
export type TareaFilters = { frenteId?: number; estado?: TareaEstado; pendientes?: boolean };

export type ActividadInput = {
  titulo: string; frente_id: number | null; tarea_id: number | null;
  inicio_programado: string; fin_programado: string;
};
export type ActividadPatch = Partial<ActividadInput>;
export type ActividadFilters = {
  fechaInicio?: string; fechaFin?: string; frenteId?: number; tareaId?: number; estado?: ActividadEstado;
};
export type CierreActividadInput = {
  estado: Exclude<ActividadEstado, 'programada'>; minutos_efectivos: number | null; resultado: string | null;
};
export type DerivadaActividadInput = { nuevo_inicio: string; nuevo_fin: string; titulo: string | null };

export const CAPTURA_ESTADOS = ['pendiente', 'procesada', 'descartada'] as const;
export type CapturaEstado = typeof CAPTURA_ESTADOS[number];
export type ProcesarCapturaInput =
  | { destino: 'tarea'; frente_id: number | null }
  | { destino: 'actividad'; frente_id: number | null; tarea_id: number | null; inicio_programado: string; fin_programado: string }
  | { destino: 'frente'; nombre: string; proposito: string; categoria: FrenteCategoria }
  | { destino: 'idea'; frente_id: number | null }
  | { destino: 'decision'; frente_id: number | null; descripcion: string | null; motivo: string | null; fecha_decision: string }
  | { destino: 'descartar' };
export type IdeaInput = { titulo:string; descripcion:string|null; frente_id:number|null };
export type IdeaPatch = Partial<IdeaInput & { estado:'activa'|'archivada' }>;
export type ConvertirIdeaInput =
  | { destino:'tarea'; frente_id:number|null }
  | { destino:'actividad'; frente_id:number|null; tarea_id:number|null; inicio_programado:string; fin_programado:string }
  | { destino:'frente'; nombre:string; proposito:string; categoria:FrenteCategoria };
export type DecisionInput = { titulo:string; descripcion:string|null; motivo:string|null; fecha_decision:string; frente_id:number|null };
export type DecisionPatch = Partial<DecisionInput>;
export type Congruencia = 'congruente'|'en_riesgo'|'descuidado'|'sobreatendido';
export type RevisionFrenteInput = { frente_id:number; congruencia_confirmada:Congruencia|null; que_ocurrio:string|null; que_bloqueo:string|null; que_aprendi:string|null; que_cambiare:string|null };
export type ProximaIntencionInput = IntencionSemanalInput & { frente_id:number };
export type RevisionSemanalInput = { semana_inicio:string; atencion_esperada:string; frentes_descuidados:string; aprendizaje_principal:string; ajuste_general:string; frentes:RevisionFrenteInput[]; proximas_intenciones:ProximaIntencionInput[] };
