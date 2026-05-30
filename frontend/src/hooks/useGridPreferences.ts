import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  GridColDef,
  GridColumnVisibilityModel,
  GridFilterModel,
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
  applySavedWidthsToColumns: <TRow>(columns: GridColDef<TRow>[]) => GridColDef<TRow>[];
  persistExternalFilters: (value: TExternalFilters) => void;
};

const SAVE_DEBOUNCE_MS = 700;

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

  const hasHydratedRef = useRef(false);
  const saveTimeoutRef = useRef<number | null>(null);

  const loadPreferences = useCallback(async () => {
    setLoadingPreferences(true);

    try {
      const stored = await fetchGridPreferences(pantalla, perfilDispositivo);
      const next = stored ?? {};

      setSortModelState(Array.isArray(next.sortModel) ? (next.sortModel as GridSortModel) : defaultSortModel);
      setFilterModelState(
        next.filterModel && typeof next.filterModel === 'object'
          ? (next.filterModel as GridFilterModel)
          : defaultFilterModel
      );
      setColumnVisibilityModelState(
        next.columnVisibilityModel && typeof next.columnVisibilityModel === 'object'
          ? (next.columnVisibilityModel as GridColumnVisibilityModel)
          : defaultColumnVisibilityModel
      );
      setColumnWidthsState(
        next.columnWidths && typeof next.columnWidths === 'object'
          ? (next.columnWidths as Record<string, number>)
          : {}
      );
      setColumnOrderState(Array.isArray(next.columnOrder) ? (next.columnOrder as string[]) : defaultColumnOrder);

      const storedExternalFilters =
        next.externalFilters && typeof next.externalFilters === 'object'
          ? (next.externalFilters as TExternalFilters)
          : defaultExternalFilters;

      setExternalFilters(storedExternalFilters);
      if (storedExternalFilters && onLoadExternalFilters) {
        onLoadExternalFilters(storedExternalFilters);
      }
    } catch (error) {
      console.error('No se pudieron cargar preferencias de grid', error);
    } finally {
      hasHydratedRef.current = true;
      setLoadingPreferences(false);
    }
  }, [
    defaultColumnOrder,
    defaultColumnVisibilityModel,
    defaultExternalFilters,
    defaultFilterModel,
    defaultSortModel,
    onLoadExternalFilters,
    pantalla,
    perfilDispositivo,
  ]);

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

    saveTimeoutRef.current = window.setTimeout(() => {
      void saveGridPreferences(pantalla, perfilDispositivo, payload).catch((error) => {
        console.error('No se pudieron guardar preferencias de grid', error);
      });
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

  const applySavedWidthsToColumns = useCallback(
    <TRow,>(columns: GridColDef<TRow>[]): GridColDef<TRow>[] =>
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
    setExternalFilters(value);
  }, []);

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
