// Flag reversible para CRM > Actividades (lista + detalle).
// El workspace es la vista predeterminada. El query param fuerza una vista
// sin depender de lo guardado.
//
// Cómo volver a la bandeja anterior:
//   - Botón "Vista clásica" en el panel izquierdo, o
//   - `?vistaActividades=clasica`

const PREFERENCE_PREFIX = 'emphasys:crm:actividades-workspace';
const QUERY_PARAM = 'vistaActividades';

const obtenerLlave = (empresaId: number | null, usuarioId: number | null): string | null => {
  if (!empresaId || !usuarioId) return null;
  return `${PREFERENCE_PREFIX}:${empresaId}:${usuarioId}`;
};

export const guardarActividadesWorkspacePreferencia = (
  empresaId: number | null,
  usuarioId: number | null,
  valor: boolean,
): void => {
  const llave = obtenerLlave(empresaId, usuarioId);
  if (!llave) return;
  try {
    window.localStorage.setItem(llave, valor ? '1' : '0');
  } catch {
    // localStorage puede no estar disponible; la sesión actual igual cambia de vista.
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

export const resolveActividadesWorkspaceEnabled = (empresaId: number | null, usuarioId: number | null): boolean => {
  const override = leerOverrideQueryParam();
  if (override === 'workspace') return true;
  if (override === 'clasica') return false;
  const llave = obtenerLlave(empresaId, usuarioId);
  if (!llave) return true;
  try {
    const valor = window.localStorage.getItem(llave);
    return valor == null ? true : valor === '1';
  } catch {
    return true;
  }
};
