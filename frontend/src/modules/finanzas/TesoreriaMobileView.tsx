import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { FinanzasCuenta, FinanzasOperacion } from '../../types/finanzas';
import { MOBILE_APPBAR_HEIGHT } from '../../components/layoutConstants';
import type { FiltroMovimiento } from './buscadorMovimientosLogica';
import { movimientoGeneralPendiente } from './FilaCapturaMovimiento';
import { estadoMovimiento } from './seleccionMovimientos';
import { TesoreriaMobileAccount } from './TesoreriaMobileAccount';
import { TesoreriaMobileAccounts } from './TesoreriaMobileAccounts';
import { TesoreriaMobileMovementEditor } from './TesoreriaMobileMovementEditor';

type Aviso = (mensaje: string, severity: 'success' | 'error' | 'info') => void;

type Flujo =
  | { tipo: 'nuevo' }
  | { tipo: 'editar'; operacion: FinanzasOperacion };

type Props = {
  vista: 'cuentas' | 'cuenta';
  onVista: (vista: 'cuentas' | 'cuenta') => void;
  cuentas: FinanzasCuenta[];
  loadingCuentas: boolean;
  selectedCuenta: FinanzasCuenta | null;
  operaciones: FinanzasOperacion[];
  operacionesVisibles: FinanzasOperacion[];
  loadingOps: boolean;
  formatoMoneda: Intl.NumberFormat;
  error: string | null;
  onDismissError: () => void;
  onSelectCuenta: (id: number) => void;
  onSelectTodas: () => void;
  onNuevaCuenta: () => void;
  onEditarCuenta: (cuenta: FinanzasCuenta) => void;
  onEliminarCuenta: (cuenta: FinanzasCuenta) => void;
  onRecalcularSaldos?: (() => void) | undefined;
  onProgramacionPagos: () => void;
  onOpenDetalle: (operacion: FinanzasOperacion) => void;
  onOpenOrigen: (ruta: string) => void;
  onRefresh: (cuentaId: number) => Promise<void>;
  onAviso: Aviso;
  query: string;
  setQuery: (value: string) => void;
  filtros: FiltroMovimiento[];
  setFiltros: (value: FiltroMovimiento[]) => void;
};

export function TesoreriaMobileView({
  vista,
  onVista,
  cuentas,
  loadingCuentas,
  selectedCuenta,
  operaciones,
  operacionesVisibles,
  loadingOps,
  formatoMoneda,
  error,
  onDismissError,
  onSelectCuenta,
  onSelectTodas,
  onNuevaCuenta,
  onEditarCuenta,
  onEliminarCuenta,
  onRecalcularSaldos,
  onProgramacionPagos,
  onOpenDetalle,
  onOpenOrigen,
  onRefresh,
  onAviso,
  query,
  setQuery,
  filtros,
  setFiltros,
}: Props) {
  const tokens = useTheme().emphasys;
  const [flujo, setFlujo] = useState<Flujo | null>(null);
  const operacionesCuenta = selectedCuenta
    ? operaciones.filter((operacion) => operacion.cuenta_id === selectedCuenta.id)
    : operaciones;
  const operacionesVisiblesCuenta = selectedCuenta
    ? operacionesVisibles.filter((operacion) => operacion.cuenta_id === selectedCuenta.id)
    : operacionesVisibles;

  useEffect(() => {
    if (vista === 'cuentas') setFlujo(null);
  }, [vista]);

  const cuentaVista = selectedCuenta ?? {
    id: -1,
    identificador: 'Todas las cuentas',
    moneda: 'MXN',
    saldo: cuentas.reduce((total, cuenta) => total + Number(cuenta.saldo ?? 0), 0),
  } as FinanzasCuenta;

  const abrirMovimiento = (operacion: FinanzasOperacion) => {
    if (operacion.naturaleza_operacion === 'cobro_cliente') {
      onOpenDetalle(operacion);
      return;
    }
    if (operacion.es_transferencia || operacion.transferencia_id) {
      if (estadoMovimiento(operacion) !== 'pendiente' || !operacion.transferencia_id) {
        onAviso('Este movimiento no se puede editar.', 'info');
        return;
      }
      setFlujo({ tipo: 'editar', operacion });
      return;
    }
    if (movimientoGeneralPendiente(operacion)) {
      setFlujo({ tipo: 'editar', operacion });
      return;
    }
    onAviso('Este movimiento no se puede editar.', 'info');
  };

  let contenido: React.ReactNode;
  if (flujo?.tipo === 'nuevo' || flujo?.tipo === 'editar') {
    const operacion = flujo.tipo === 'editar' ? flujo.operacion : null;
    contenido = (
      <TesoreriaMobileMovementEditor
        key={operacion ? `editar-${operacion.id}` : 'nuevo'}
        operacion={operacion}
        cuentas={cuentas}
        cuentaInicialId={selectedCuenta?.id ?? null}
        onBack={() => setFlujo(null)}
        onRefresh={onRefresh}
        onAviso={onAviso}
      />
    );
  } else if (vista === 'cuenta') {
    contenido = (
      <TesoreriaMobileAccount
        cuenta={cuentaVista}
        operaciones={operacionesCuenta}
        operacionesVisibles={operacionesVisiblesCuenta}
        loading={loadingOps}
        error={error}
        formatoMoneda={formatoMoneda}
        query={query}
        setQuery={setQuery}
        filtros={filtros}
        setFiltros={setFiltros}
        onBack={() => {
          setQuery('');
          setFiltros([]);
          onVista('cuentas');
        }}
        onNuevoMovimiento={() => setFlujo({ tipo: 'nuevo' })}
        onEditarCuenta={onEditarCuenta}
        onEliminarCuenta={onEliminarCuenta}
        onProgramacionPagos={onProgramacionPagos}
        onOpenMovimiento={abrirMovimiento}
        onOpenOrigen={onOpenOrigen}
      />
    );
  } else {
    contenido = (
      <TesoreriaMobileAccounts
        cuentas={cuentas}
        loading={loadingCuentas}
        error={error}
        onDismissError={onDismissError}
        onSelect={(cuenta) => {
          onSelectCuenta(cuenta.id);
          onVista('cuenta');
        }}
        onSelectTodas={() => {
          onSelectTodas();
          onVista('cuenta');
        }}
        onNuevaCuenta={onNuevaCuenta}
        onProgramacionPagos={onProgramacionPagos}
        onRecalcularSaldos={onRecalcularSaldos}
      />
    );
  }

  return (
    <Box
      sx={{
        height: `calc(100dvh - ${MOBILE_APPBAR_HEIGHT}px)`,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        bgcolor: tokens.content.background,
        color: tokens.content.foreground,
      }}
    >
      {contenido}
    </Box>
  );
}
