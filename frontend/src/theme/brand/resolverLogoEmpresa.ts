import type { ColoresEmpresa } from './empresaBrand.ts';
import { tieneIdentidadPersonalizada } from './logoPolicy.ts';

type IdentidadMinima = { colores?: Partial<ColoresEmpresa> | null } | null;

export type FuentesLogoEmpresa = {
  /** Colores recién guardados. Si se omite, se leen del servidor. */
  colores?: ColoresEmpresa | null;
  /** Caché que ya pintó la marca. Solo autoriza el logo si el servidor no responde. */
  cache?: ColoresEmpresa | null;
  fetchIdentidad: (id: number) => Promise<IdentidadMinima>;
  fetchAsset: (id: number, tipo: string) => Promise<{ ruta?: string | null } | null>;
};

/**
 * Ruta del logo empresarial, o null para seguir con Emphasys.
 * Con identidad en caché pide el asset sin esperar al servidor: un fallo de esa
 * confirmación no puede ocultar el logo si los colores ya están en pantalla.
 * Si el servidor responde sin colores guardados, el resultado es null.
 */
export async function resolverLogoEmpresa(id: number, fuentes: FuentesLogoEmpresa): Promise<string | null> {
  const explicitos = fuentes.colores !== undefined;
  const cache = !explicitos && tieneIdentidadPersonalizada(fuentes.cache) ? fuentes.cache : null;

  const pedir = async () => {
    const asset = await fuentes.fetchAsset(id, 'logo_default');
    return asset?.ruta || null;
  };

  if (cache) {
    const ruta = await pedir();
    try {
      const identidad = await fuentes.fetchIdentidad(id);
      if (!tieneIdentidadPersonalizada(identidad?.colores)) return null;
    } catch {
      // La misma caché que mantiene los colores autoriza el logo.
    }
    return ruta;
  }

  let colores: Partial<ColoresEmpresa> | null | undefined = fuentes.colores ?? null;
  if (!explicitos) {
    try {
      colores = (await fuentes.fetchIdentidad(id))?.colores ?? null;
    } catch {
      colores = fuentes.cache ?? null;
    }
  }
  if (!tieneIdentidadPersonalizada(colores)) return null;
  return pedir();
}
