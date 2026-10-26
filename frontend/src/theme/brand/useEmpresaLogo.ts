import { useEffect, useState } from 'react';
import { buildAssetUrl, fetchEmpresaAsset } from '../../services/empresasAssetsService';
import { EVENTO_IDENTIDAD_ACTUALIZADA, type DetalleIdentidadActualizada } from '../../services/identidadVisualService';
import { resolverLogoEmpresa } from './resolverLogoEmpresa.ts';

/** Logo del ERP: el asset `logo_default` de la empresa si existe; si no, el `fallback` (Emphasys). */
export function useEmpresaLogo(empresaId: number | null, fallback: string): string {
  const [logo, setLogo] = useState(fallback);

  useEffect(() => {
    let vigente = true;
    let solicitud = 0;
    const cargar = async (id: number) => {
      const actual = ++solicitud;
      setLogo(fallback);
      try {
        const ruta = await resolverLogoEmpresa(id, { fetchAsset: fetchEmpresaAsset });
        if (vigente && actual === solicitud && ruta) setLogo(buildAssetUrl(ruta));
      } catch {
        // Sin asset o sin acceso: permanece el predeterminado.
      }
    };

    if (empresaId) void cargar(empresaId);
    else setLogo(fallback);

    const alActualizar = (evento: Event) => {
      const { empresaId: id } = (evento as CustomEvent<DetalleIdentidadActualizada>).detail;
      if (id === empresaId) void cargar(id);
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
