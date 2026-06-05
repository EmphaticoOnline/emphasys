import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  GridColDef,
  GridColumnVisibilityModel,
  GridFilterModel,
  GridValidRowModel,
  GridSortModel,
} from '@mui/x-data-grid';
import type {
  GridDeviceProfile,
  GridPreferencesPayload,
} from '../services/gridPreferencesService';
import {
  fetchGridPreferences,
  saveGridPreferences,
} from '../services/gridPreferencesService';

const SESSION_STORAGE_KEY = 'emphasys.session';

type UseGridPreferencesParams<TExternalFilters extends Record<string, unknown>> = {
  pantalla: string;
  perfilDispositivo: GridDeviceProfile;
  defaultSortModel?: GridSortModel;
  defaultFilterModel?: GridFilterModel;
  defaultColumnVisibilityModel?: GridColumnVisibilityModel;
  defaultColumnOrder?: string[];
  defaultExternalFilters?: TExternalFilters;
  onLoadExternalFilters?: (value: TExternalFilters) => void;
};

type UseGridPreferencesResult<TExternalFilters extends Record<string, unknown>> = {
  loadingPreferences: boolean;
  sortModel: GridSortModel;
  setSortModel: (model: GridSortModel) => void;
  filterModel: GridFilterModel;
  setFilterModel: (model: GridFilterModel) => void;
  columnVisibilityModel: GridColumnVisibilityModel;
  setColumnVisibilityModel: (model: GridColumnVisibilityModel) => void;
  columnWidths: Record<string, number>;
  setColumnWidths: (updater: (prev: Record<string, number>) => Record<string, number>) => void;
  columnOrder: string[];
  setColumnOrder: (updater: (prev: string[]) => string[]) => void;
  applySavedWidthsToColumns: <TRow extends GridValidRowModel>(columns: GridColDef<TRow>[]) => GridColDef<TRow>[];
  persistExternalFilters: (value: TExternalFilters) => void;
};

const SAVE_DEBOUNCE_MS = 700;

function getSessionScopeKey(): string {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return 'anonymous:0';
    const parsed = JSON.parse(raw) as {
      user?: { id?: number | string };
      empresaActivaId?: number | string;
    };
    const userId = Number(parsed?.user?.id ?? 0);
    const empresaId = Number(parsed?.empresaActivaId ?? 0);
    return `${userId}:${empresaId}`;
  } catch {
    return 'anonymous:0';
  }
}

function toStableString(value: unknown): string {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
}

export function useGridPreferences<TExternalFilters extends Record<string, unknown> = Record<string, unknown>>(
  params: UseGridPreferencesParams<TExternalFilters>
): UseGridPreferencesResult<TExternalFilters> {
  const {
    pantalla,
    perfilDispositivo,
    defaultSortModel = [],
    defaultFilterModel = { items: [] },
    defaultColumnVisibilityModel = {},
    defaultColumnOrder = [],
    defaultExternalFilters,
    onLoadExternalFilters,
  } = params;

  const [loadingPreferences, setLoadingPreferences] = useState(true);
  const [sortModel, setSortModelState] = useState<GridSortModel>(defaultSortModel);
  const [filterModel, setFilterModelState] = useState<GridFilterModel>(defaultFilterModel);
  const [columnVisibilityModel, setColumnVisibilityModelState] = useState<GridColumnVisibilityModel>(defaultColumnVisibilityModel);
  const [columnWidths, setColumnWidthsState] = useState<Record<string, number>>({});
  const [columnOrder, setColumnOrderState] = useState<string[]>(defaultColumnOrder);
  const [externalFilters, setExternalFilters] = useState<TExternalFilters | undefined>(defaultExternalFilters);
  const [sessionScopeKey, setSessionScopeKey] = useState<string>(() => getSessionScopeKey());

  const hasHydratedRef = useRef(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const lastSavedPayloadRef = useRef<string>('');
  const pendingPayloadRef = useRef<GridPreferencesPayload | null>(null);
  const pendingPayloadStringRef = useRef<string>('');
  const defaultSortModelRef = useRef<GridSortModel>(defaultSortModel);
  const defaultFilterModelRef = useRef<GridFilterModel>(defaultFilterModel);
  const defaultColumnVisibilityModelRef = useRef<GridColumnVisibilityModel>(defaultColumnVisibilityModel);
  const defaultColumnOrderRef = useRef<string[]>(defaultColumnOrder);
  const defaultExternalFiltersRef = useRef<TExternalFilters | undefined>(defaultExternalFilters);
  const onLoadExternalFiltersRef = useRef<typeof onLoadExternalFilters>(onLoadExternalFilters);

  useEffect(() => {
    defaultSortModelRef.current = defaultSortModel;
    defaultFilterModelRef.current = defaultFilterModel;
    defaultColumnVisibilityModelRef.current = defaultColumnVisibilityModel;
    defaultColumnOrderRef.current = defaultColumnOrder;
    defaultExternalFiltersRef.current = defaultExternalFilters;
    onLoadExternalFiltersRef.current = onLoadExternalFilters;
  }, [
    defaultColumnOrder,
    defaultColumnVisibilityModel,
    defaultExternalFilters,
    defaultFilterModel,
    defaultSortModel,
    onLoadExternalFilters,
  ]);

  useEffect(() => {
    setSessionScopeKey(getSessionScopeKey());

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== SESSION_STORAGE_KEY) return;
      setSessionScopeKey(getSessionScopeKey());
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const loadPreferences = useCallback(async () => {
    setLoadingPreferences(true);

    try {
      const stored = await fetchGridPreferences(pantalla, perfilDispositivo);
      const next = stored ?? {};

      const defaultSort = defaultSortModelRef.current;
      const defaultFilter = defaultFilterModelRef.current;
      const defaultVisibility = defaultColumnVisibilityModelRef.current;
      const defaultOrder = defaultColumnOrderRef.current;
      const defaultExternal = defaultExternalFiltersRef.current;

      setSortModelState(Array.isArray(next.sortModel) ? (next.sortModel as GridSortModel) : defaultSort);
      setFilterModelState(
        next.filterModel
        && typeof next.filterModel === 'object'
        && Array.isArray((next.filterModel as { items?: unknown }).items)
          ? (next.filterModel as unknown as GridFilterModel)
          : defaultFilter
      );
      setColumnVisibilityModelState(
        next.columnVisibilityModel && typeof next.columnVisibilityModel === 'object'
          ? (next.columnVisibilityModel as GridColumnVisibilityModel)
          : defaultVisibility
      );
      setColumnWidthsState(
        next.columnWidths && typeof next.columnWidths === 'object'
          ? (next.columnWidths as Record<string, number>)
          : {}
      );
      setColumnOrderState(Array.isArray(next.columnOrder) ? (next.columnOrder as string[]) : defaultOrder);

      const storedExternalFilters =
        next.externalFilters && typeof next.externalFilters === 'object'
          ? (next.externalFilters as TExternalFilters)
          : defaultExternal;

      setExternalFilters(storedExternalFilters);
      if (storedExternalFilters && onLoadExternalFiltersRef.current) {
        onLoadExternalFiltersRef.current(storedExternalFilters);
      }

      const initialPayload: GridPreferencesPayload = {
        version: 1,
        sortModel: Array.isArray(next.sortModel) ? next.sortModel : defaultSort,
        filterModel:
          next.filterModel
          && typeof next.filterModel === 'object'
          && Array.isArray((next.filterModel as { items?: unknown }).items)
            ? next.filterModel
            : defaultFilter,
        columnVisibilityModel:
          next.columnVisibilityModel && typeof next.columnVisibilityModel === 'object'
            ? next.columnVisibilityModel
            : defaultVisibility,
        columnWidths:
          next.columnWidths && typeof next.columnWidths === 'object'
            ? next.columnWidths
            : {},
        columnOrder: Array.isArray(next.columnOrder) ? next.columnOrder : defaultOrder,
        externalFilters: (storedExternalFilters ?? {}) as Record<string, unknown>,
      };
      lastSavedPayloadRef.current = toStableString(initialPayload);
    } catch (error) {
      console.error('No se pudieron cargar preferencias de grid', error);
    } finally {
      hasHydratedRef.current = true;
      setLoadingPreferences(false);
    }
  }, [pantalla, perfilDispositivo, sessionScopeKey]);

  useEffect(() => {
    void loadPreferences();
  }, [loadPreferences]);

  useEffect(() => {
    if (!hasHydratedRef.current) return;

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    const payload: GridPreferencesPayload = {
      version: 1,
      sortModel,
      filterModel,
      columnVisibilityModel,
      columnWidths,
      columnOrder,
      externalFilters: externalFilters ?? {},
    };

    const nextPayloadString = toStableString(payload);
    if (nextPayloadString === lastSavedPayloadRef.current) {
      pendingPayloadRef.current = null;
      pendingPayloadStringRef.current = '';
      return;
    }

    pendingPayloadRef.current = payload;
    pendingPayloadStringRef.current = nextPayloadString;

    saveTimeoutRef.current = window.setTimeout(() => {
      void saveGridPreferences(pantalla, perfilDispositivo, payload).catch((error) => {
        console.error('No se pudieron guardar preferencias de grid', error);
      });
      lastSavedPayloadRef.current = nextPayloadString;
      pendingPayloadRef.current = null;
      pendingPayloadStringRef.current = '';
      saveTimeoutRef.current = null;
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    columnOrder,
    columnVisibilityModel,
    columnWidths,
    externalFilters,
    filterModel,
    pantalla,
    perfilDispositivo,
    sortModel,
  ]);

  useEffect(() => {
    return () => {
      if (!hasHydratedRef.current) return;

      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }

      if (!pendingPayloadRef.current || pendingPayloadStringRef.current === lastSavedPayloadRef.current) {
        return;
      }

      void saveGridPreferences(pantalla, perfilDispositivo, pendingPayloadRef.current).catch((error) => {
        console.error('No se pudieron guardar preferencias de grid al desmontar', error);
      });
      lastSavedPayloadRef.current = pendingPayloadStringRef.current;
      pendingPayloadRef.current = null;
      pendingPayloadStringRef.current = '';
    };
  }, [pantalla, perfilDispositivo]);

  const applySavedWidthsToColumns = useCallback(
    <TRow extends GridValidRowModel,>(columns: GridColDef<TRow>[]): GridColDef<TRow>[] =>
      columns.map((column) => {
        const savedWidth = columnWidths[column.field];
        if (savedWidth === undefined) {
          return column;
        }

        const { flex, ...rest } = column;
        return { ...rest, width: savedWidth };
      }),
    [columnWidths]
  );

  const setSortModel = useCallback((model: GridSortModel) => {
    setSortModelState(model);
  }, []);

  const setFilterModel = useCallback((model: GridFilterModel) => {
    setFilterModelState(model);
  }, []);

  const setColumnVisibilityModel = useCallback((model: GridColumnVisibilityModel) => {
    setColumnVisibilityModelState(model);
  }, []);

  const setColumnWidths = useCallback((updater: (prev: Record<string, number>) => Record<string, number>) => {
    setColumnWidthsState((prev) => updater(prev));
  }, []);

  const setColumnOrder = useCallback((updater: (prev: string[]) => string[]) => {
    setColumnOrderState((prev) => updater(prev));
  }, []);

  const persistExternalFilters = useCallback((value: TExternalFilters) => {
    const next = toStableString(value);
    const current = toStableString(externalFilters);
    if (next === current) {
      return;
    }
    setExternalFilters(value);
  }, [externalFilters]);

  return useMemo(
    () => ({
      loadingPreferences,
      sortModel,
      setSortModel,
      filterModel,
      setFilterModel,
      columnVisibilityModel,
      setColumnVisibilityModel,
      columnWidths,
      setColumnWidths,
      columnOrder,
      setColumnOrder,
      applySavedWidthsToColumns,
      persistExternalFilters,
    }),
    [
      applySavedWidthsToColumns,
      columnOrder,
      columnVisibilityModel,
      columnWidths,
      filterModel,
      loadingPreferences,
      persistExternalFilters,
      setColumnOrder,
      setColumnVisibilityModel,
      setColumnWidths,
      setFilterModel,
      setSortModel,
      sortModel,
    ]
  );
}
