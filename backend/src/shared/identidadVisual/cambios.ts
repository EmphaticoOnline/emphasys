import type { RolIdentidad } from './contraste';

/**
 * Identidad visual por empresa: cómo un PUT cambia los colores aprobados.
 * Módulo puro: el servicio lo aplica dentro de la transacción, sobre la fila
 * bloqueada, y las pruebas lo ejercitan sin base de datos.
 */

export type OrigenColor = 'emphasys' | 'analisis' | 'manual';
export type ModoIdentidad = 'emphasys' | 'personalizado';
type PorRol<T> = Record<RolIdentidad, T>;

export type ColoresVigentes = {
  colores: PorRol<string | null>;
  origen: PorRol<OrigenColor>;
  /** Propuesta del último análisis con estado 'ok'; null si no hay. */
  propuesta: PorRol<string> | null;
  superficieSecundaria?: string | null;
  modo?: ModoIdentidad;
};

export type ResultadoCambios =
  | { ok: true; colores: PorRol<string | null>; origen: PorRol<OrigenColor>; superficieSecundaria: string | null; modo: ModoIdentidad; cambiados: RolIdentidad[] }
  | { ok: false; conflictos: RolIdentidad[] };

/** Sin fila: todo es Emphasys. */
export const VIGENTES_EMPHASYS: ColoresVigentes = {
  colores: { primario: null, acento: null, sidebar: null },
  origen: { primario: 'emphasys', acento: 'emphasys', sidebar: 'emphasys' },
  propuesta: null,
  superficieSecundaria: null,
  modo: 'emphasys',
};

/**
 * Aplica `cambios` (hex ya normalizados; null = volver a Emphasys; un rol
 * ausente no cambia) sobre `vigentes`.
 *
 * - El origen lo decide el servidor: null → emphasys; igual a la propuesta
 *   vigente → analisis; cualquier otro valor → manual.
 * - Un color igual al vigente no cambia ni su valor ni su origen.
 * - Cambiar un color manual exige `confirmarSobrescritura` (decisión 9); si
 *   falta, no se aplica nada y se devuelven todos los conflictos.
 */
export function aplicarCambios(
  vigentes: ColoresVigentes,
  cambios: Partial<PorRol<string | null>>,
  confirmarSobrescritura: boolean,
  superficieSecundaria: string | null | undefined = undefined,
  modo: ModoIdentidad | undefined = undefined,
): ResultadoCambios {
  const colores = { ...vigentes.colores };
  const origen = { ...vigentes.origen };
  const conflictos: RolIdentidad[] = [];
  const cambiados: RolIdentidad[] = [];

  for (const rol of Object.keys(cambios) as RolIdentidad[]) {
    const nuevo = cambios[rol];
    if (nuevo === undefined || nuevo === vigentes.colores[rol]) continue;
    if (vigentes.origen[rol] === 'manual' && !confirmarSobrescritura) {
      conflictos.push(rol);
      continue;
    }
    colores[rol] = nuevo;
    origen[rol] = nuevo === null ? 'emphasys' : nuevo === vigentes.propuesta?.[rol] ? 'analisis' : 'manual';
    cambiados.push(rol);
  }

  return conflictos.length ? { ok: false, conflictos } : {
    ok: true,
    colores,
    origen,
    superficieSecundaria: superficieSecundaria === undefined ? (vigentes.superficieSecundaria ?? null) : superficieSecundaria,
    modo: modo ?? vigentes.modo ?? 'emphasys',
    cambiados,
  };
}
