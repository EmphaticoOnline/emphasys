import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSession } from '../../session/useSession';
import type { FinanzasCuenta } from '../../types/finanzas';
import { fetchCuentas } from '../../services/finanzasService';

const claveCuenta = (empresaId: number | null) => `emphasys.tesoreria.cuenta.${empresaId ?? 'sin-empresa'}`;

const leerNumero = (value: string | null) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const leerCuentaGuardada = (empresaId: number | null) => {
  try {
    return leerNumero(localStorage.getItem(claveCuenta(empresaId)));
  } catch {
    return null;
  }
};

export function useTesoreriaAccounts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { session } = useSession();
  const [cuentas, setCuentas] = useState<FinanzasCuenta[]>([]);
  const [selectedCuentaId, setSelectedCuentaId] = useState<number | null>(null);
  const [todasSeleccionadas, setTodasSeleccionadas] = useState(false);
  const [loadingCuentas, setLoadingCuentas] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedCuenta = useMemo(
    () => cuentas.find((c) => c.id === selectedCuentaId) || null,
    [cuentas, selectedCuentaId],
  );
  const monedaCuenta = selectedCuenta?.moneda || 'MXN';
  const formatoMoneda = useMemo(
    () => new Intl.NumberFormat('es-MX', { style: 'currency', currency: monedaCuenta }),
    [monedaCuenta],
  );

  const aplicarCuenta = (id: number | null) => {
    setSelectedCuentaId(id);
    setTodasSeleccionadas(id === null);
    const empresaId = session.empresaActivaId;
    if (!id) {
      try { localStorage.removeItem(claveCuenta(empresaId)); } catch { /* almacenamiento opcional */ }
      if (searchParams.has('cuenta_id')) setSearchParams({}, { replace: true });
      return;
    }
    try { localStorage.setItem(claveCuenta(empresaId), String(id)); } catch { /* el navegador puede bloquear el almacenamiento */ }
    if (searchParams.get('cuenta_id') !== String(id)) {
      setSearchParams({ cuenta_id: String(id) }, { replace: true });
    }
  };

  const loadCuentas = async () => {
    try {
      setLoadingCuentas(true);
      const data = await fetchCuentas();
      setCuentas(data);
      const preferida = leerNumero(searchParams.get('cuenta_id'))
        ?? selectedCuentaId
        ?? leerCuentaGuardada(session.empresaActivaId);
      const siguiente = todasSeleccionadas
        ? null
        : preferida && data.some((c) => c.id === preferida)
        ? preferida
        : (data[0]?.id ?? null);
      aplicarCuenta(siguiente);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'No se pudieron cargar las cuentas');
    } finally {
      setLoadingCuentas(false);
    }
  };

  useEffect(() => {
    void loadCuentas();
    // Recarga solo al cambiar de empresa, igual que en la página antes de extraer el hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.empresaActivaId]);

  return {
    cuentas,
    selectedCuentaId,
    selectedCuenta,
    loadingCuentas,
    error,
    setError,
    monedaCuenta,
    formatoMoneda,
    aplicarCuenta,
    loadCuentas,
    searchParams,
  };
}
