import type { ColoresEmpresa, ModoIdentidad } from './empresaBrand.ts';
import type { ModoPresentacionLogo } from '../../services/identidadVisualService';

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

export type IdentidadCache = { colores: ColoresEmpresa; modo: ModoIdentidad; modoPresentacionLogo: ModoPresentacionLogo };
export function leerColoresCache(empresaId: number, store: Almacen | null = almacen()): IdentidadCache | null {
  try {
    const raw = store?.getItem(`${PREFIJO}${empresaId}`);
    if (!raw) return null;
    const { primario = null, acento = null, sidebar = null, superficie_secundaria = null, modo = 'personalizado', modoPresentacionLogo = 'automatico' } = JSON.parse(raw) ?? {};
    return { colores: { primario, acento, sidebar, superficie_secundaria }, modo, modoPresentacionLogo };
  } catch {
    return null;
  }
}

export function guardarColoresCache(empresaId: number, colores: ColoresEmpresa, modo: ModoIdentidad, modoPresentacionLogo: ModoPresentacionLogo = 'automatico', store: Almacen | null = almacen()): void {
  try {
    store?.setItem(`${PREFIJO}${empresaId}`, JSON.stringify({ ...colores, modo, modoPresentacionLogo }));
  } catch {
    /* sin almacenamiento: se queda en memoria */
  }
}
