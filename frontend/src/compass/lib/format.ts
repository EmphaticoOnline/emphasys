// All formatters below parse the plain wall-clock components out of the ISO
// string and re-assemble them with Date.UTC + timeZone: "UTC". This keeps
// output identical between server and client regardless of the runtime's
// local timezone, avoiding hydration mismatches from date-only strings like
// "2026-08-18" (which `new Date()` would otherwise interpret as UTC midnight
// and then render shifted by a day in a negative-offset local timezone).

function parseComponentes(iso: string) {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/)
  if (!match) return { y: 1970, m: 1, d: 1, hh: 0, mm: 0 }
  const [, y, m, d, hh, mm] = match
  return {
    y: Number(y),
    m: Number(m),
    d: Number(d),
    hh: hh ? Number(hh) : 0,
    mm: mm ? Number(mm) : 0,
  }
}

function comoFechaUTC(iso: string) {
  const { y, m, d, hh, mm } = parseComponentes(iso)
  return new Date(Date.UTC(y, m - 1, d, hh, mm))
}

export function formatHora(iso: string) {
  return comoFechaUTC(iso).toLocaleTimeString("es-MX", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  })
}

export function formatFechaCorta(iso: string) {
  return comoFechaUTC(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
}

export function formatFechaLarga(iso: string) {
  return comoFechaUTC(iso).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  })
}

export function formatDuracionMin(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

export function duracionMinutos(inicio: string, fin: string) {
  return Math.round((comoFechaUTC(fin).getTime() - comoFechaUTC(inicio).getTime()) / 60000)
}

export function horasEntre(inicio: string, fin: string) {
  return duracionMinutos(inicio, fin) / 60
}

/** Componentes de hora/minuto en punto de pared, sin conversiones de zona horaria. */
export function horaYMinuto(iso: string) {
  const { hh, mm } = parseComponentes(iso)
  return { hora: hh, minuto: mm }
}

/** Fecha (YYYY-MM-DD) en punto de pared, sin conversiones de zona horaria. */
export function soloFecha(iso: string) {
  return iso.slice(0, 10)
}

export function capitalizarPrimera(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
