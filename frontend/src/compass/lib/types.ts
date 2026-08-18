export type Categoria = "Personal" | "Profesional"

export type EstadoFrente = "Activo" | "Pausado" | "Completado" | "Archivado"

export type Prioridad = "Alta" | "Media" | "Baja"

export type Expectativa = "Sin compromiso" | "Atender" | "Prioritario"

export type EstadoCongruencia = "Congruente" | "En riesgo" | "Descuidado" | "Sobreatendido"

export interface Frente {
  id: string
  nombre: string
  proposito: string
  categoria: Categoria
  estado: EstadoFrente
  siguienteAccion: string
  color: string
}

export interface IntencionSemanal {
  frenteId: string
  semanaId: string
  prioridad: Prioridad
  horasObjetivo?: number | undefined
  expectativa?: Expectativa | undefined
}

export interface MedicionSemanal {
  frenteId: string
  semanaId: string
  horasProtegidas: number
  horasEfectivas: number
}

export type EstadoTarea = "Pendiente" | "Completada"

export interface Tarea {
  id: string
  titulo: string
  frenteId?: string | undefined
  fechaLimite?: string | undefined
  prioridad?: Prioridad | undefined
  estado: EstadoTarea
}

export type EstadoActividad = "Programada" | "Realizada" | "Parcial" | "No realizada" | "Cancelada"

export interface Actividad {
  id: string
  titulo: string
  frenteId?: string | undefined
  tareaId?: string | undefined
  inicio: string
  fin: string
  estado: EstadoActividad
  tiempoEfectivoMin?: number | undefined
  resultado?: string | undefined
  reprogramadaDeId?: string | undefined
  creadaDesdeId?: string | undefined
}

export interface CapturaItem {
  id: string
  texto: string
  fecha: string
  procesado: boolean
  destino?: "Frente" | "Tarea" | "Actividad" | "Idea" | "Decision" | "Descartada" | undefined
}

export interface Idea {
  id: string
  texto: string
  frenteId?: string | undefined
  fecha: string
}

export interface Decision {
  id: string
  que: string
  porque: string
  fecha: string
  frenteId?: string | undefined
}

export interface RevisionSemanal {
  semanaId: string
  atencionEsperada: string
  descuidados: string
  aprendizaje: string
  cambios: string
  intencionProxima: string
  completada: boolean
}

export interface Semana {
  id: string
  etiqueta: string
  etiquetaCorta: string
}

export interface IntencionProximaFrente {
  frenteId: string
  prioridad?: Prioridad | undefined
  horasObjetivo?: number | undefined
  expectativa?: Expectativa | undefined
  congruenciaConfirmada?: EstadoCongruencia | undefined
}
