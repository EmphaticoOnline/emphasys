// Datos demo heredados del prototipo v0. Ninguna ruta funcional actual de
// Compass depende ya de estas colecciones; se conservan sólo para componentes
// visuales antiguos que permanecen desmontados.
import type {
  Actividad,
  CapturaItem,
  Decision,
  Frente,
  Idea,
  IntencionSemanal,
  MedicionSemanal,
  RevisionSemanal,
  Semana,
  Tarea,
} from "./types"

export const SEMANA_ACTUAL = {
  id: "2026-W34",
  etiqueta: "17–23 de agosto",
}

export const semanasRecientes: Semana[] = [
  { id: "2026-W31", etiqueta: "27 jul – 2 ago", etiquetaCorta: "S31" },
  { id: "2026-W32", etiqueta: "3 – 9 ago", etiquetaCorta: "S32" },
  { id: "2026-W33", etiqueta: "10 – 16 ago", etiquetaCorta: "S33" },
  { id: SEMANA_ACTUAL.id, etiqueta: SEMANA_ACTUAL.etiqueta, etiquetaCorta: "S34" },
]

export const HOY = "2026-08-18"

export const paletaColoresFrente = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"]

export const frentes: Frente[] = [
  {
    id: "erp",
    nombre: "Emphasys — Desarrollo ERP",
    proposito: "Construir un ERP propio que le dé independencia y margen a la empresa a largo plazo.",
    categoria: "Profesional",
    estado: "Activo",
    siguienteAccion: "Revisar con el equipo el módulo de facturación",
    color: "chart-5",
  },
  {
    id: "comercializacion",
    nombre: "Comercialización",
    proposito: "Sostener y ampliar la cartera de clientes activos sin depender de un solo canal.",
    categoria: "Profesional",
    estado: "Activo",
    siguienteAccion: "Cerrar propuesta con cliente de manufactura",
    color: "chart-2",
  },
  {
    id: "salud",
    nombre: "Salud",
    proposito: "Mantener energía y claridad mental sostenibles, no rendimiento de corto plazo.",
    categoria: "Personal",
    estado: "Activo",
    siguienteAccion: "Agendar chequeo médico pendiente",
    color: "chart-1",
  },
  {
    id: "familia",
    nombre: "Familia",
    proposito: "Estar presente en los momentos que no se repiten.",
    categoria: "Personal",
    estado: "Activo",
    siguienteAccion: "Planear el fin de semana con los niños",
    color: "chart-4",
  },
  {
    id: "finanzas",
    nombre: "Finanzas personales",
    proposito: "Tener claridad y margen de decisión sobre el dinero propio.",
    categoria: "Personal",
    estado: "Pausado",
    siguienteAccion: "Retomar revisión de presupuesto trimestral",
    color: "chart-3",
  },
]

export const intencionesSemanales: IntencionSemanal[] = [
  { frenteId: "erp", semanaId: SEMANA_ACTUAL.id, prioridad: "Alta", horasObjetivo: 15 },
  { frenteId: "comercializacion", semanaId: SEMANA_ACTUAL.id, prioridad: "Media", horasObjetivo: 8 },
  { frenteId: "salud", semanaId: SEMANA_ACTUAL.id, prioridad: "Media", expectativa: "Atender" },
  { frenteId: "familia", semanaId: SEMANA_ACTUAL.id, prioridad: "Alta", horasObjetivo: 6 },
]

export const medicionesSemanales: MedicionSemanal[] = [
  { frenteId: "erp", semanaId: SEMANA_ACTUAL.id, horasProtegidas: 10, horasEfectivas: 6 },
  { frenteId: "comercializacion", semanaId: SEMANA_ACTUAL.id, horasProtegidas: 7, horasEfectivas: 7.5 },
  { frenteId: "salud", semanaId: SEMANA_ACTUAL.id, horasProtegidas: 1.5, horasEfectivas: 0.5 },
  { frenteId: "familia", semanaId: SEMANA_ACTUAL.id, horasProtegidas: 6, horasEfectivas: 9 },
]

// Historial de las últimas semanas, usado para mostrar la evolución de
// atención por frente (incluye la semana actual, duplicada de arriba).
export const historialMediciones: MedicionSemanal[] = [
  { frenteId: "erp", semanaId: "2026-W31", horasProtegidas: 12, horasEfectivas: 9 },
  { frenteId: "erp", semanaId: "2026-W32", horasProtegidas: 14, horasEfectivas: 13 },
  { frenteId: "erp", semanaId: "2026-W33", horasProtegidas: 12, horasEfectivas: 8 },
  { frenteId: "erp", semanaId: SEMANA_ACTUAL.id, horasProtegidas: 10, horasEfectivas: 6 },

  { frenteId: "comercializacion", semanaId: "2026-W31", horasProtegidas: 6, horasEfectivas: 5 },
  { frenteId: "comercializacion", semanaId: "2026-W32", horasProtegidas: 8, horasEfectivas: 6 },
  { frenteId: "comercializacion", semanaId: "2026-W33", horasProtegidas: 7, horasEfectivas: 6.5 },
  { frenteId: "comercializacion", semanaId: SEMANA_ACTUAL.id, horasProtegidas: 7, horasEfectivas: 7.5 },

  { frenteId: "salud", semanaId: "2026-W31", horasProtegidas: 3, horasEfectivas: 2.5 },
  { frenteId: "salud", semanaId: "2026-W32", horasProtegidas: 2, horasEfectivas: 1 },
  { frenteId: "salud", semanaId: "2026-W33", horasProtegidas: 2, horasEfectivas: 0.5 },
  { frenteId: "salud", semanaId: SEMANA_ACTUAL.id, horasProtegidas: 1.5, horasEfectivas: 0.5 },

  { frenteId: "familia", semanaId: "2026-W31", horasProtegidas: 5, horasEfectivas: 5.5 },
  { frenteId: "familia", semanaId: "2026-W32", horasProtegidas: 6, horasEfectivas: 6 },
  { frenteId: "familia", semanaId: "2026-W33", horasProtegidas: 6, horasEfectivas: 7 },
  { frenteId: "familia", semanaId: SEMANA_ACTUAL.id, horasProtegidas: 6, horasEfectivas: 9 },
]

// Intenciones históricas correspondientes, para poder sugerir congruencia
// en cada punto de la evolución (no solo en la semana actual).
export const historialIntenciones: IntencionSemanal[] = [
  { frenteId: "erp", semanaId: "2026-W31", prioridad: "Alta", horasObjetivo: 12 },
  { frenteId: "erp", semanaId: "2026-W32", prioridad: "Alta", horasObjetivo: 12 },
  { frenteId: "erp", semanaId: "2026-W33", prioridad: "Alta", horasObjetivo: 14 },
  { frenteId: "erp", semanaId: SEMANA_ACTUAL.id, prioridad: "Alta", horasObjetivo: 15 },

  { frenteId: "comercializacion", semanaId: "2026-W31", prioridad: "Media", horasObjetivo: 6 },
  { frenteId: "comercializacion", semanaId: "2026-W32", prioridad: "Media", horasObjetivo: 8 },
  { frenteId: "comercializacion", semanaId: "2026-W33", prioridad: "Media", horasObjetivo: 7 },
  { frenteId: "comercializacion", semanaId: SEMANA_ACTUAL.id, prioridad: "Media", horasObjetivo: 8 },

  { frenteId: "salud", semanaId: "2026-W31", prioridad: "Media", expectativa: "Atender" },
  { frenteId: "salud", semanaId: "2026-W32", prioridad: "Media", expectativa: "Atender" },
  { frenteId: "salud", semanaId: "2026-W33", prioridad: "Alta", expectativa: "Prioritario" },
  { frenteId: "salud", semanaId: SEMANA_ACTUAL.id, prioridad: "Media", expectativa: "Atender" },

  { frenteId: "familia", semanaId: "2026-W31", prioridad: "Alta", horasObjetivo: 5 },
  { frenteId: "familia", semanaId: "2026-W32", prioridad: "Alta", horasObjetivo: 6 },
  { frenteId: "familia", semanaId: "2026-W33", prioridad: "Alta", horasObjetivo: 6 },
  { frenteId: "familia", semanaId: SEMANA_ACTUAL.id, prioridad: "Alta", horasObjetivo: 6 },
]

export const tareas: Tarea[] = [
  {
    id: "t1",
    titulo: "Revisar bitácora de bugs del módulo de facturación",
    frenteId: "erp",
    fechaLimite: "2026-08-19",
    prioridad: "Alta",
    estado: "Pendiente",
  },
  {
    id: "t2",
    titulo: "Preparar propuesta comercial para cliente de manufactura",
    frenteId: "comercializacion",
    fechaLimite: "2026-08-20",
    prioridad: "Alta",
    estado: "Pendiente",
  },
  {
    id: "t3",
    titulo: "Agendar chequeo médico anual",
    frenteId: "salud",
    fechaLimite: "2026-08-22",
    prioridad: "Media",
    estado: "Pendiente",
  },
  {
    id: "t4",
    titulo: "Comprar regalo de cumpleaños de mi papá",
    fechaLimite: "2026-08-21",
    prioridad: "Media",
    estado: "Pendiente",
  },
  {
    id: "t5",
    titulo: "Definir alcance de la siguiente iteración del ERP",
    frenteId: "erp",
    prioridad: "Media",
    estado: "Pendiente",
  },
  {
    id: "t6",
    titulo: "Renovar póliza del seguro del coche",
    fechaLimite: "2026-08-25",
    prioridad: "Baja",
    estado: "Pendiente",
  },
  {
    id: "t7",
    titulo: "Enviar seguimiento a tres prospectos de la feria",
    frenteId: "comercializacion",
    fechaLimite: "2026-08-18",
    prioridad: "Media",
    estado: "Completada",
  },
]

export const actividades: Actividad[] = [
  {
    id: "a1",
    titulo: "Bloque profundo — módulo de facturación",
    frenteId: "erp",
    tareaId: "t1",
    inicio: "2026-08-18T08:30:00",
    fin: "2026-08-18T10:30:00",
    estado: "Realizada",
    tiempoEfectivoMin: 100,
    resultado: "Se identificaron 4 bugs críticos, quedan documentados para el equipo.",
  },
  {
    id: "a2",
    titulo: "Llamada con cliente de manufactura",
    frenteId: "comercializacion",
    tareaId: "t2",
    inicio: "2026-08-18T11:00:00",
    fin: "2026-08-18T12:00:00",
    estado: "Programada",
  },
  {
    id: "a3",
    titulo: "Comida con la familia",
    frenteId: "familia",
    inicio: "2026-08-18T13:30:00",
    fin: "2026-08-18T14:30:00",
    estado: "Programada",
  },
  {
    id: "a4",
    titulo: "Revisión de arquitectura con el equipo de ERP",
    frenteId: "erp",
    inicio: "2026-08-18T16:00:00",
    fin: "2026-08-18T17:30:00",
    estado: "Programada",
  },
  {
    id: "a5",
    titulo: "Caminata / movimiento",
    frenteId: "salud",
    inicio: "2026-08-18T18:00:00",
    fin: "2026-08-18T18:30:00",
    estado: "Programada",
  },
  {
    id: "a6",
    titulo: "Tarea con los niños",
    frenteId: "familia",
    inicio: "2026-08-18T19:30:00",
    fin: "2026-08-18T20:15:00",
    estado: "Programada",
  },
  {
    id: "a7",
    titulo: "Cierre de sprint — equipo ERP",
    frenteId: "erp",
    inicio: "2026-08-17T09:00:00",
    fin: "2026-08-17T11:00:00",
    estado: "Realizada",
    tiempoEfectivoMin: 115,
    resultado: "Sprint cerrado, retraso menor en el módulo de reportes.",
  },
  {
    id: "a8",
    titulo: "Revisión de presupuesto trimestral",
    frenteId: "finanzas",
    inicio: "2026-08-17T20:00:00",
    fin: "2026-08-17T21:00:00",
    estado: "No realizada",
  },
  {
    id: "a9",
    titulo: "Entrenamiento en el gimnasio",
    frenteId: "salud",
    inicio: "2026-08-17T07:00:00",
    fin: "2026-08-17T07:45:00",
    estado: "Parcial",
    tiempoEfectivoMin: 20,
    resultado: "Se cortó por una llamada urgente del equipo.",
  },
  {
    id: "a10",
    titulo: "Seguimiento a prospectos de la feria",
    frenteId: "comercializacion",
    tareaId: "t7",
    inicio: "2026-08-18T15:00:00",
    fin: "2026-08-18T15:30:00",
    estado: "Realizada",
    tiempoEfectivoMin: 30,
    resultado: "Dos de tres respondieron, uno pide propuesta formal.",
  },
  {
    id: "a11",
    titulo: "Planeación del fin de semana en familia",
    frenteId: "familia",
    inicio: "2026-08-19T20:00:00",
    fin: "2026-08-19T20:30:00",
    estado: "Programada",
  },
  {
    id: "a12",
    titulo: "Bloque de diseño de datos — ERP",
    frenteId: "erp",
    inicio: "2026-08-19T09:00:00",
    fin: "2026-08-19T11:00:00",
    estado: "Programada",
  },
]

export const ideas: Idea[] = [
  {
    id: "i1",
    texto: "Ofrecer una versión ligera del ERP para clientes pequeños como puerta de entrada.",
    frenteId: "erp",
    fecha: "2026-08-12",
  },
  {
    id: "i2",
    texto: "Explorar una caminata semanal fija con toda la familia, no solo los niños.",
    frenteId: "familia",
    fecha: "2026-08-14",
  },
  {
    id: "i3",
    texto: "Probar un formato de webinar corto para atraer prospectos sin depender de ferias.",
    frenteId: "comercializacion",
    fecha: "2026-08-15",
  },
  {
    id: "i4",
    texto: "Buscar un chequeo médico anual con revisión de sueño incluida.",
    frenteId: "salud",
    fecha: "2026-08-16",
  },
  {
    id: "i5",
    texto: "Tal vez valga la pena un frente separado para escritura o proyectos creativos.",
    fecha: "2026-08-17",
  },
]

export const decisiones: Decision[] = [
  {
    id: "d1",
    que: "Priorizar el módulo de facturación antes que el de inventarios.",
    porque: "Es lo que más bloquea a los primeros clientes piloto.",
    fecha: "2026-08-05",
    frenteId: "erp",
  },
  {
    id: "d2",
    que: "Dejar de asistir a ferias genéricas y enfocarse en referidos directos.",
    porque: "El costo por prospecto calificado era demasiado alto.",
    fecha: "2026-08-10",
    frenteId: "comercializacion",
  },
  {
    id: "d3",
    que: "Pausar la revisión de finanzas personales este mes.",
    porque: "No hay capacidad real de atenderla bien mientras el ERP está en fase crítica.",
    fecha: "2026-08-11",
    frenteId: "finanzas",
  },
]

export const bandeja: CapturaItem[] = [
  { id: "c1", texto: "Llamar al contador antes de fin de mes", fecha: "2026-08-18T07:12:00", procesado: false },
  {
    id: "c2",
    texto: "Se me ocurrió automatizar el reporte semanal de horas por frente",
    fecha: "2026-08-17T21:40:00",
    procesado: false,
  },
  { id: "c3", texto: "Preguntar a mamá si quiere venir el sábado", fecha: "2026-08-17T13:05:00", procesado: false },
  {
    id: "c4",
    texto: "Revisar si el ERP necesita un módulo de reportes fiscales propio",
    fecha: "2026-08-16T18:22:00",
    procesado: false,
  },
  { id: "c5", texto: "Separar tiempo para leer con calma este fin de semana", fecha: "2026-08-16T09:50:00", procesado: false },
]

export const revisionSemanaAnterior: RevisionSemanal = {
  semanaId: "2026-W33",
  atencionEsperada: "Comercialización y ERP recibieron la atención que había planeado.",
  descuidados: "Salud quedó por debajo de lo esperado otra vez, sobre todo el sueño.",
  aprendizaje: "Cuando protejo bloques cortos de salud en la mañana, sí se sostienen mejor que en la noche.",
  cambios: "Mover el movimiento físico a primera hora del día en vez de después del trabajo.",
  intencionProxima: "Mantener ERP como prioridad alta y subir Salud a Prioritario esta semana.",
  completada: true,
}

export function getFrente(id?: string) {
  return frentes.find((f) => f.id === id)
}

export function getIntencion(frenteId: string) {
  return intencionesSemanales.find((i) => i.frenteId === frenteId && i.semanaId === SEMANA_ACTUAL.id)
}

export function getMedicion(frenteId: string) {
  return medicionesSemanales.find((m) => m.frenteId === frenteId && m.semanaId === SEMANA_ACTUAL.id)
}

export function getTareasDeFrente(frenteId: string) {
  return tareas.filter((t) => t.frenteId === frenteId)
}

export function getActividadesDeFrente(frenteId: string) {
  return actividades
    .filter((a) => a.frenteId === frenteId)
    .sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime())
}

export function getIdeasDeFrente(frenteId: string) {
  return ideas.filter((i) => i.frenteId === frenteId)
}

export function getDecisionesDeFrente(frenteId: string) {
  return decisiones.filter((d) => d.frenteId === frenteId)
}

export function getHistorialDeFrente(frenteId: string) {
  return semanasRecientes.map((semana) => {
    const intencion = historialIntenciones.find((i) => i.frenteId === frenteId && i.semanaId === semana.id)
    const medicion = historialMediciones.find((m) => m.frenteId === frenteId && m.semanaId === semana.id)
    return { semana, intencion, medicion }
  })
}
