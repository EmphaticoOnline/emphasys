// Flag reversible para seleccionar la vista de Facturas (lista + panel de
// trabajo) sin afectar a ningún otro tipo de documento. El workspace es la
// vista predeterminada y el query param permite forzar cualquiera de las dos
// vistas sin persistir nada.
//
// Cómo volver atrás en cualquier momento:
//   - Usar `?vistaFacturas=clasica` para forzar temporalmente la vista anterior.

const PREFERENCE_PREFIX = 'emphasys:documentos:facturas-workspace';
const QUERY_PARAM = 'vistaFacturas';

const obtenerLlaveFacturasWorkspacePreferencia = (empresaId: number | null, usuarioId: number | null): string | null => {
  if (!empresaId || !usuarioId) return null;
  return `${PREFERENCE_PREFIX}:${empresaId}:${usuarioId}`;
};

const leerFacturasWorkspacePreferencia = (empresaId: number | null, usuarioId: number | null): boolean => {
  const llave = obtenerLlaveFacturasWorkspacePreferencia(empresaId, usuarioId);
  if (!llave) return false;
  try {
    return window.localStorage.getItem(llave) === '1';
  } catch {
    return false;
  }
};

export const guardarFacturasWorkspacePreferencia = (
  empresaId: number | null,
  usuarioId: number | null,
  valor: boolean
): void => {
  const llave = obtenerLlaveFacturasWorkspacePreferencia(empresaId, usuarioId);
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

// Resuelve si el workspace de Facturas debe mostrarse. El query param manda
// (permite forzar cualquiera de los dos estados sin depender de lo guardado);
// si no hay override en la URL, el workspace es la vista predeterminada.
export const resolveFacturasWorkspaceEnabled = (empresaId: number | null, usuarioId: number | null): boolean => {
  const override = leerOverrideQueryParam();
  if (override === 'workspace') return true;
  if (override === 'clasica') return false;
  return true;
};
