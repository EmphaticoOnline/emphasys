// Flag reversible para seleccionar la vista de Cotizaciones (lista + panel de
// trabajo) sin afectar a Facturas ni a ningún otro tipo de documento. El
// workspace es la vista predeterminada y el query param permite forzar
// cualquiera de las dos vistas sin persistir nada.
//
// Cómo volver atrás en cualquier momento:
//   - Usar `?vistaCotizaciones=clasica` para forzar temporalmente la vista anterior.

const PREFERENCE_PREFIX = 'emphasys:documentos:cotizaciones-workspace';
const QUERY_PARAM = 'vistaCotizaciones';

const obtenerLlaveCotizacionesWorkspacePreferencia = (empresaId: number | null, usuarioId: number | null): string | null => {
  if (!empresaId || !usuarioId) return null;
  return `${PREFERENCE_PREFIX}:${empresaId}:${usuarioId}`;
};

export const guardarCotizacionesWorkspacePreferencia = (
  empresaId: number | null,
  usuarioId: number | null,
  valor: boolean
): void => {
  const llave = obtenerLlaveCotizacionesWorkspacePreferencia(empresaId, usuarioId);
  if (!llave) return;
  try {
    window.localStorage.setItem(llave, valor ? '1' : '0');
  } catch {
    // localStorage puede no estar disponible (modo privado, cuotas); no es crítico.
  }
};

const leerOverrideQueryParam = (): 'workspace' | 'clasica' | null => {
  try {
    const value = new URLSearchParams(window.location.search).get(QUERY_PARAM);
    if (value === 'workspace' || value === 'clasica') return value;
    return null;
  } catch {
    return null;
  }
};

// Resuelve si el workspace de Cotizaciones debe mostrarse. El query param manda
// (permite forzar cualquiera de los dos estados sin depender de lo guardado);
// si no hay override en la URL, se respeta la preferencia guardada y, si no
// existe, el workspace es la vista predeterminada.
export const resolveCotizacionesWorkspaceEnabled = (empresaId: number | null, usuarioId: number | null): boolean => {
  const override = leerOverrideQueryParam();
  if (override === 'workspace') return true;
  if (override === 'clasica') return false;
  const llave = obtenerLlaveCotizacionesWorkspacePreferencia(empresaId, usuarioId);
  if (!llave) return true;
  try {
    const valor = window.localStorage.getItem(llave);
    return valor == null ? true : valor === '1';
  } catch {
    return true;
  }
};
