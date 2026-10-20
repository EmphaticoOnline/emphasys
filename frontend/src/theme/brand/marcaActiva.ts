/**
 * Qué empresa decide la marca de la pantalla actual. Login y selección de
 * empresa conservan siempre la identidad de Emphasys; sin sesión o sin empresa
 * activa, también.
 */
export const RUTAS_IDENTIDAD_EMPHASYS = ['/login', '/seleccionar-empresa'] as const;

export function empresaParaMarca({
  pathname,
  token,
  empresaActivaId,
}: {
  pathname: string;
  token: string | null;
  empresaActivaId: number | null;
}): number | null {
  if (!token || !empresaActivaId) return null;
  const ruta = pathname.replace(/\/+$/, '') || '/';
  if (RUTAS_IDENTIDAD_EMPHASYS.some((r) => ruta === r || ruta.startsWith(`${r}/`))) return null;
  return empresaActivaId;
}
