import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchIdentidadVisual } from '../../services/identidadVisualService';
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
  const [confirmados, setConfirmados] = useState<Record<number, ColoresEmpresa>>({});

  useEffect(() => {
    if (!session.token) return undefined;
    let vigente = true;
    const ids = [session.empresaActivaId, ...session.empresas.map((e) => e.id)].filter(
      (id, i, todos): id is number => typeof id === 'number' && todos.indexOf(id) === i,
    );
    (async () => {
      for (const id of ids) {
        try {
          const { colores } = await fetchIdentidadVisual(id);
          if (!vigente) return;
          guardarColoresCache(id, colores);
          setConfirmados((previos) => ({ ...previos, [id]: colores }));
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

  const colores = empresaId === null ? null : (confirmados[empresaId] ?? leerColoresCache(empresaId));
  const clave = colores ? `${colores.primario}|${colores.acento}|${colores.sidebar}` : '';
  // getEmpresaBrand ya devuelve la misma instancia para los mismos colores.
  return useMemo(() => getEmpresaBrand(colores), [empresaId, clave]); // eslint-disable-line react-hooks/exhaustive-deps
}
