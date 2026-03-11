import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchCamposConfiguracion, fetchCatalogoDinamico } from '../services/camposDinamicosService';
import type { CamposConfiguracionFiltro } from '../services/camposDinamicosService';
import type { CampoConfiguracion, CatalogoValor } from '../types/camposDinamicos';

export type UseCamposDinamicosParams = {
  entidadTipoId?: number;
  entidadTipoCodigo?: string;
  tipoDocumento?: string;
};

export type UseCamposDinamicosResult = {
  campos: CampoConfiguracion[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  dependencias: Record<number, number[]>;
  getOptions: (campoId: number, parentId?: number | null) => CatalogoValor[];
  loadOptions: (campoId: number, parentId?: number | null) => Promise<void>;
  optionsLoading: Record<string, boolean>;
};

function optionsKey(campoId: number, parentId?: number | null) {
  return `${campoId}::${parentId ?? 'root'}`;
}

export function useCamposDinamicos(params: UseCamposDinamicosParams): UseCamposDinamicosResult {
  const [campos, setCampos] = useState<CampoConfiguracion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optionsCache, setOptionsCache] = useState<Record<string, CatalogoValor[]>>({});
  const [optionsLoading, setOptionsLoading] = useState<Record<string, boolean>>({});

  const loadCampos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
  const filtro: CamposConfiguracionFiltro = {};
  if (params.entidadTipoId !== undefined) filtro.entidad_tipo_id = params.entidadTipoId;
  if (params.entidadTipoCodigo) filtro.entidad_tipo_codigo = params.entidadTipoCodigo;
  if (params.tipoDocumento) filtro.tipo_documento = params.tipoDocumento;

  const data = await fetchCamposConfiguracion(filtro);
      setCampos(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudieron cargar los campos dinámicos';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [params.entidadTipoCodigo, params.entidadTipoId, params.tipoDocumento]);

  useEffect(() => {
    loadCampos();
  }, [loadCampos]);

  const dependencias = useMemo(() => {
    const map: Record<number, number[]> = {};
    campos.forEach((campo) => {
      if (campo.campo_padre_id) {
        const parentId = campo.campo_padre_id;
        const hijos = map[parentId] || [];
        hijos.push(campo.id);
        map[parentId] = hijos;
      }
    });
    return map;
  }, [campos]);

  const getOptions = useCallback(
    (campoId: number, parentId?: number | null) => optionsCache[optionsKey(campoId, parentId)] || [],
    [optionsCache]
  );

  const loadOptions = useCallback(
    async (campoId: number, parentId?: number | null) => {
      const campo = campos.find((c) => c.id === campoId);
      if (!campo || !campo.catalogo_tipo_id) return;
      const key = optionsKey(campoId, parentId);
      if (optionsCache[key]) return;

      setOptionsLoading((prev) => ({ ...prev, [key]: true }));
      try {
        const opts = await fetchCatalogoDinamico(campo.catalogo_tipo_id, parentId ?? null);
        setOptionsCache((prev) => ({ ...prev, [key]: opts }));
      } catch (e) {
        console.error('No se pudieron cargar opciones de catálogo', e);
      } finally {
        setOptionsLoading((prev) => ({ ...prev, [key]: false }));
      }
    },
    [campos, optionsCache]
  );

  return {
    campos,
    loading,
    error,
    reload: loadCampos,
    dependencias,
    getOptions,
    loadOptions,
    optionsLoading,
  };
}
