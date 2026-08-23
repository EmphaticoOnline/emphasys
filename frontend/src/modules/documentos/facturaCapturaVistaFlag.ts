// Flag reversible para seleccionar la vista de captura/edición de Factura
// (clásica vs. nueva) sin afectar a ningún otro tipo de documento. La vista
// clásica es la predeterminada; el query param permite forzar cualquiera de
// las dos vistas sin persistir nada. Mismo patrón que
// `facturasWorkspaceFlag.ts` para el listado de facturas.
//
// Cómo volver atrás en cualquier momento:
//   - Usar `?vistaFactura=clasica` para forzar la vista clásica.
//   - Usar `?vistaFactura=nueva` para forzar la nueva captura.

export type VistaCapturaFactura = 'clasica' | 'nueva';

const PREFERENCE_PREFIX = 'emphasys:documentos:factura-captura-vista';
const QUERY_PARAM = 'vistaFactura';

const obtenerLlaveFacturaCapturaVistaPreferencia = (empresaId: number | null, usuarioId: number | null): string | null => {
  if (!empresaId || !usuarioId) return null;
  return `${PREFERENCE_PREFIX}:${empresaId}:${usuarioId}`;
};

const leerFacturaCapturaVistaPreferenciaGuardada = (empresaId: number | null, usuarioId: number | null): VistaCapturaFactura | null => {
  const llave = obtenerLlaveFacturaCapturaVistaPreferencia(empresaId, usuarioId);
  if (!llave) return null;
  try {
    const valor = window.localStorage.getItem(llave);
    return valor === 'nueva' || valor === 'clasica' ? valor : null;
  } catch {
    return null;
  }
};

export const guardarFacturaCapturaVistaPreferencia = (
  empresaId: number | null,
  usuarioId: number | null,
  vista: VistaCapturaFactura
): void => {
  const llave = obtenerLlaveFacturaCapturaVistaPreferencia(empresaId, usuarioId);
  if (!llave) return;
  try {
    window.localStorage.setItem(llave, vista);
  } catch {
    // localStorage puede no estar disponible (modo privado, cuotas); no es crítico.
  }
};

const leerOverrideQueryParam = (): VistaCapturaFactura | null => {
  try {
    const value = new URLSearchParams(window.location.search).get(QUERY_PARAM);
    return value === 'nueva' || value === 'clasica' ? value : null;
  } catch {
    return null;
  }
};

// Resuelve con qué vista debe abrir la captura de Factura. El query param
// manda (permite forzar cualquiera de los dos estados sin depender de lo
// guardado); si no hay override en la URL, se usa la preferencia guardada
// del usuario y, si tampoco existe, la vista clásica por defecto.
export const resolveFacturaCapturaVistaInicial = (empresaId: number | null, usuarioId: number | null): VistaCapturaFactura => {
  const override = leerOverrideQueryParam();
  if (override) return override;
  return leerFacturaCapturaVistaPreferenciaGuardada(empresaId, usuarioId) ?? 'clasica';
};
