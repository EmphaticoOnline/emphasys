import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  EVENTO_IDENTIDAD_ACTUALIZADA,
  fetchIdentidadVisual,
  type DetalleIdentidadActualizada,
} from '../../services/identidadVisualService';
import { useSession } from '../../session/useSession';
import { getEmpresaBrand, type ColoresEmpresa } from './empresaBrand.ts';
import { guardarColoresCache, leerColoresCache } from './identidadVisualCache.ts';
import { empresaParaMarca } from './marcaActiva.ts';
import type { BrandDefinition } from './types.ts';

/**
 * Marca de la pantalla actual según la empresa activa.
 *
 * - Primer render con los colores en caché (sin parpadeo); luego se confirman
 *   con el servidor y se actualiza la caché.
 * - Las demás empresas de la sesión se precargan en segundo plano, para que
 *   cambiar de empresa no pase por Emphasys.
 * - Si el servidor falla (o aún no tiene el endpoint), se queda la caché o
 *   Emphasys, sin mostrar errores.
 */
export function useEmpresaBrand(): BrandDefinition {
  const { session } = useSession();
  const { pathname } = useLocation();
  const empresaId = empresaParaMarca({ pathname, token: session.token, empresaActivaId: session.empresaActivaId });
  const [confirmados, setConfirmados] = useState<Record<number, { colores: ColoresEmpresa; modo: 'emphasys' | 'personalizado' }>>({});

  useEffect(() => {
    if (!session.token) return undefined;
    let vigente = true;
    const ids = [session.empresaActivaId, ...session.empresas.map((e) => e.id)].filter(
      (id, i, todos): id is number => typeof id === 'number' && todos.indexOf(id) === i,
    );
    (async () => {
      for (const id of ids) {
        try {
          const datos = await fetchIdentidadVisual(id);
          const { colores } = datos;
          if (!vigente) return;
          const modo = datos.modo ?? 'emphasys';
          const normalizados = { ...colores, superficie_secundaria: datos.superficie_secundaria ?? colores.superficie_secundaria ?? null };
          guardarColoresCache(id, normalizados, modo);
          setConfirmados((previos) => ({ ...previos, [id]: { colores: normalizados, modo } }));
        } catch {
          /* sin acceso o sin endpoint: se conserva la caché o Emphasys */
        }
      }
    })();
    return () => {
      vigente = false;
    };
    // Se confirma al iniciar sesión y al cambiar de empresa activa.
  }, [session.token, session.empresaActivaId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al guardar en la pantalla de identidad visual, la app aplica los colores sin recargar.
  useEffect(() => {
    const alGuardar = (evento: Event) => {
      const { empresaId: id, colores, modo } = (evento as CustomEvent<DetalleIdentidadActualizada>).detail;
      guardarColoresCache(id, colores, modo);
      setConfirmados((previos) => ({ ...previos, [id]: { colores, modo } }));
    };
    window.addEventListener(EVENTO_IDENTIDAD_ACTUALIZADA, alGuardar);
    return () => window.removeEventListener(EVENTO_IDENTIDAD_ACTUALIZADA, alGuardar);
  }, []);

  const identidad = empresaId === null ? null : (confirmados[empresaId] ?? leerColoresCache(empresaId));
  const colores = identidad?.colores ?? null;
  const modo = identidad?.modo ?? 'emphasys';
  const clave = colores ? `${modo}|${colores.primario}|${colores.acento}|${colores.sidebar}|${colores.superficie_secundaria}` : '';
  // getEmpresaBrand ya devuelve la misma instancia para los mismos colores.
  return useMemo(() => getEmpresaBrand(colores, undefined, modo), [empresaId, clave, modo]);
}
