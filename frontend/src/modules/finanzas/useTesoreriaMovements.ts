import { useEffect, useMemo, useState } from 'react';
import type { FinanzasOperacion } from '../../types/finanzas';
import { fetchOperaciones } from '../../services/finanzasService';
import { filtrarMovimientos, type FiltroMovimiento } from './buscadorMovimientosLogica';

export function useTesoreriaMovements(
  cuentaId: number | null,
  setError: (message: string | null) => void,
) {
  const [operaciones, setOperaciones] = useState<FinanzasOperacion[]>([]);
  const [loadingOps, setLoadingOps] = useState(false);
  const [movQuery, setMovQuery] = useState('');
  const [movFiltros, setMovFiltros] = useState<FiltroMovimiento[]>([]);

  const operacionesVisibles = useMemo(
    () => filtrarMovimientos(operaciones, movFiltros, movQuery),
    [operaciones, movFiltros, movQuery],
  );

  const loadOperaciones = async (id: number | null = cuentaId) => {
    try {
      setLoadingOps(true);
      const data = await fetchOperaciones(id);
      setOperaciones(data);
    } catch (err: any) {
      setError(err?.message || 'No se pudieron cargar los movimientos');
    } finally {
      setLoadingOps(false);
    }
  };

  useEffect(() => {
    setMovQuery('');
    setMovFiltros([]);
  }, [cuentaId]);

  useEffect(() => {
    void loadOperaciones(cuentaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuentaId]);

  return {
    operaciones,
    loadingOps,
    loadOperaciones,
    movQuery,
    setMovQuery,
    movFiltros,
    setMovFiltros,
    operacionesVisibles,
  };
}
