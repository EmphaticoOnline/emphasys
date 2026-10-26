import * as React from 'react';
import { EVENTO_IDENTIDAD_ACTUALIZADA, fetchIdentidadVisual, type ModoPresentacionLogo } from '../../services/identidadVisualService';
import { leerColoresCache } from './identidadVisualCache';

/** Presentación guardada del logotipo; es independiente del modo de colores (Emphasys o personalizado). */
export function useEmpresaLogoPresentation(empresaId: number | null): ModoPresentacionLogo {
  const [modo, setModo] = React.useState<ModoPresentacionLogo>('automatico');
  React.useEffect(() => {
    let active = true;
    if (!empresaId) { setModo('automatico'); return () => { active = false; }; }
    const cache = leerColoresCache(empresaId);
    setModo(cache?.modoPresentacionLogo ?? 'automatico');
    fetchIdentidadVisual(empresaId).then((identidad) => {
      if (active) setModo(identidad.modo_presentacion_logo ?? 'automatico');
    }).catch(() => {});
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ empresaId: number; modo: 'emphasys' | 'personalizado'; modoPresentacionLogo: ModoPresentacionLogo }>).detail;
      if (detail.empresaId === empresaId) setModo(detail.modoPresentacionLogo ?? 'automatico');
    };
    window.addEventListener(EVENTO_IDENTIDAD_ACTUALIZADA, onUpdate);
    return () => { active = false; window.removeEventListener(EVENTO_IDENTIDAD_ACTUALIZADA, onUpdate); };
  }, [empresaId]);
  return modo;
}
