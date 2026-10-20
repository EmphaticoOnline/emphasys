import type { ColoresEmpresa } from './empresaBrand.ts';

/**
 * Caché por navegador de los colores de cada empresa, para pintar su identidad
 * en el primer render (sin parpadeo) mientras se confirma con el servidor.
 * Solo son colores, no datos sensibles. Si el almacenamiento falla o está
 * vacío, la app usa Emphasys hasta que llegue la respuesta.
 */
const PREFIJO = 'emphasys.identidadVisual.v1.';

type Almacen = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const almacen = (): Almacen | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

export function leerColoresCache(empresaId: number, store: Almacen | null = almacen()): ColoresEmpresa | null {
  try {
    const raw = store?.getItem(`${PREFIJO}${empresaId}`);
    if (!raw) return null;
    const { primario = null, acento = null, sidebar = null } = JSON.parse(raw) ?? {};
    return { primario, acento, sidebar };
  } catch {
    return null;
  }
}

export function guardarColoresCache(empresaId: number, colores: ColoresEmpresa, store: Almacen | null = almacen()): void {
  try {
    if (!colores.primario && !colores.acento && !colores.sidebar) store?.removeItem(`${PREFIJO}${empresaId}`);
    else store?.setItem(`${PREFIJO}${empresaId}`, JSON.stringify(colores));
  } catch {
    /* sin almacenamiento: se queda en memoria */
  }
}
