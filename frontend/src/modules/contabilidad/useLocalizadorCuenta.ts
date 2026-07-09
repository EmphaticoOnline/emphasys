import * as React from 'react';
import { useGridApiRef } from '@mui/x-data-grid';
import { fetchConfiguracionContable } from '../../services/contabilidadService';
import { limpiarCuentaInput, aplicarMascaraCuenta, parseEstructuraCuentas } from '../../utils/cuentaContableMask';

// Localizador incremental por cuenta: NO filtra filas, solo detecta la
// primera coincidencia (comparando contra la cuenta ya formateada con la
// máscara configurada) y expone su id para resaltarla y hacerle scroll.
export function useLocalizadorCuenta<T extends { id: number; cuenta: string }>(filas: T[]) {
  const [localizarCuenta, setLocalizarCuenta] = React.useState('');
  const [filaLocalizadaId, setFilaLocalizadaId] = React.useState<number | null>(null);
  const [segmentLengths, setSegmentLengths] = React.useState<number[]>([]);
  const [caracterSeparador, setCaracterSeparador] = React.useState('-');
  const apiRef = useGridApiRef();

  React.useEffect(() => {
    fetchConfiguracionContable()
      .then((configuracion) => {
        setSegmentLengths(parseEstructuraCuentas(configuracion.estructura_cuentas));
        setCaracterSeparador(configuracion.caracter_separador);
      })
      .catch(() => {
        // Si falla, el localizador cae a comparar el texto tal cual.
      });
  }, []);

  React.useEffect(() => {
    if (!localizarCuenta.trim()) {
      setFilaLocalizadaId(null);
      return;
    }

    const digitos = limpiarCuentaInput(localizarCuenta);
    const prefijo = digitos && segmentLengths.length
      ? aplicarMascaraCuenta(digitos, segmentLengths, caracterSeparador)
      : localizarCuenta.trim();

    const encontrada = filas.find((f) => f.cuenta.startsWith(prefijo));
    setFilaLocalizadaId(encontrada?.id ?? null);

    if (encontrada) {
      const rowEl = apiRef.current?.getRowElement?.(encontrada.id);
      rowEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [localizarCuenta, filas, segmentLengths, caracterSeparador, apiRef]);

  return { localizarCuenta, setLocalizarCuenta, filaLocalizadaId, apiRef };
}
