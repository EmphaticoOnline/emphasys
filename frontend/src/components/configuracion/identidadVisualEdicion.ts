import {
  FONDOS_REFERENCIA,
  IDENTIDAD_EMPHASYS,
  normalizarHex,
  razonContraste,
  REGLAS_CONTRASTE,
  ROLES_CON_TEXTO_AUTOMATICO,
  textoSobrePrimario,
  textoSobreSidebar,
  ROLES_IDENTIDAD,
  type FondoReferencia,
  type RolIdentidad,
} from '../../../../backend/src/shared/identidadVisual/contraste.ts';
import { SUPERFICIE_SECUNDARIA_EMPHASYS } from '../../../../backend/src/shared/identidadVisual/contraste.ts';
import { textoSobreSuperficieSecundaria } from '../../../../backend/src/shared/identidadVisual/contraste.ts';
import type { ColoresEmpresa } from '../../theme/brand/empresaBrand';

/**
 * Lógica de la pantalla de identidad visual (sin React): qué cambió, qué
 * colores manuales se sobrescribirían y cómo queda el contraste de cada rol.
 */
export type Colores = ColoresEmpresa;
export type Origen = Record<RolIdentidad, 'emphasys' | 'analisis' | 'manual'>;

export const ROLES = ROLES_IDENTIDAD;
export const SIN_COLORES: Colores = { primario: null, acento: null, sidebar: null, superficie_secundaria: null };

export const ETIQUETAS: Record<RolIdentidad, { titulo: string; uso: string }> = {
  primario: { titulo: 'Primario', uso: 'Botones principales, enlaces y títulos.' },
  acento: { titulo: 'Acento', uso: 'Indicadores y detalles sobre fondos claros.' },
  sidebar: { titulo: 'Sidebar', uso: 'Menú lateral y encabezados oscuros.' },
};
export const ETIQUETA_SUPERFICIE = { titulo: 'Superficie secundaria', uso: 'Rieles de Workspace, botones y encabezados elevados.' };

export const ETIQUETA_FONDO: Record<FondoReferencia | 'texto', string> = { blanco: 'blanco', marfil: 'marfil', beige: 'beige', texto: 'su texto automático' };

/** Color que se verá: el de la empresa o, si es null, el de Emphasys. */
export const colorEfectivo = (rol: RolIdentidad, valor: string | null) => valor ?? IDENTIDAD_EMPHASYS[rol];

/** Hex escrito por el usuario → `#rrggbb` o null si aún no es válido. */
export const leerHex = (texto: string) => normalizarHex(texto.startsWith('#') ? texto : `#${texto}`);

/** Roles cuyo borrador difiere de lo guardado. */
export function rolesCambiados(guardados: Colores, borrador: Colores): RolIdentidad[] {
  return ROLES.filter((rol) => guardados[rol] !== borrador[rol]);
}

/** Roles con un color manual guardado que el borrador cambiaría (requieren confirmación). */
export function manualesAfectados(guardados: Colores, origen: Origen, borrador: Colores): RolIdentidad[] {
  return rolesCambiados(guardados, borrador).filter((rol) => origen[rol] === 'manual');
}

export type ContrasteRol = { ok: boolean; ratio: number; minimo: number; contra: FondoReferencia | 'texto' };

/** Peor contraste del color efectivo del rol contra sus fondos de referencia. */
export function contrasteRol(rol: RolIdentidad, valor: string | null): ContrasteRol {
  const color = colorEfectivo(rol, valor);
  // Primario y Sidebar son fondos: el texto se calcula, así que siempre hay un primer plano legible.
  if (ROLES_CON_TEXTO_AUTOMATICO.includes(rol)) {
    const texto = rol === 'primario' ? textoSobrePrimario(color) : textoSobreSidebar(color);
    return { ok: true, ratio: Math.round(razonContraste(color, texto) * 100) / 100, minimo: 4.5, contra: 'texto' };
  }
  const { contra, minimo } = REGLAS_CONTRASTE[rol];
  const peor = contra
    .map((fondo) => ({ contra: fondo, ratio: razonContraste(color, FONDOS_REFERENCIA[fondo]) }))
    .sort((a, b) => a.ratio - b.ratio)[0]!;
  return { ok: peor.ratio >= minimo, ratio: Math.round(peor.ratio * 100) / 100, minimo, contra: peor.contra };
}

/** Cambios a enviar en el PUT (solo los roles modificados). */
export function cuerpoCambios(guardados: Colores, borrador: Colores): Partial<Colores> {
  return Object.fromEntries(rolesCambiados(guardados, borrador).map((rol) => [rol, borrador[rol]])) as Partial<Colores>;
}

export const describirColor = (valor: string | null) => valor ?? 'Emphasys';
export { SUPERFICIE_SECUNDARIA_EMPHASYS };
export { textoSobreSuperficieSecundaria };
