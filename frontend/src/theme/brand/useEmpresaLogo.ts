import { useEffect, useState } from 'react';
import { buildAssetUrl, fetchEmpresaAsset } from '../../services/empresasAssetsService';
import {
  EVENTO_IDENTIDAD_ACTUALIZADA,
  fetchIdentidadVisual,
  type DetalleIdentidadActualizada,
} from '../../services/identidadVisualService';
import type { ColoresEmpresa } from './empresaBrand';
import { tieneIdentidadPersonalizada } from './logoPolicy';

/** Logo del ERP: solo usa el asset de empresa con identidad visual guardada. */
export function useEmpresaLogo(empresaId: number | null, fallback: string): string {
  const [logo, setLogo] = useState(fallback);

  useEffect(() => {
    let vigente = true;
    let solicitud = 0;
    const cargar = async (id: number, colores?: ColoresEmpresa | null) => {
      const actual = ++solicitud;
      setLogo(fallback);
      try {
        const identidad = colores ? { colores } : await fetchIdentidadVisual(id);
        if (!tieneIdentidadPersonalizada(identidad.colores)) return;
        const asset = await fetchEmpresaAsset(id, 'logo_default');
        if (vigente && actual === solicitud && asset?.ruta) setLogo(buildAssetUrl(asset.ruta));
      } catch {
        // Sin identidad aprobada, sin asset o sin acceso: permanece Emphasys.
      }
    };

    if (empresaId) void cargar(empresaId);
    else setLogo(fallback);

    const alActualizar = (evento: Event) => {
      const { empresaId: id, colores } = (evento as CustomEvent<DetalleIdentidadActualizada>).detail;
      if (id === empresaId) void cargar(id, colores);
    };
    window.addEventListener(EVENTO_IDENTIDAD_ACTUALIZADA, alActualizar);
    return () => {
      vigente = false;
      solicitud += 1;
      window.removeEventListener(EVENTO_IDENTIDAD_ACTUALIZADA, alActualizar);
    };
  }, [empresaId, fallback]);

  return logo;
}
