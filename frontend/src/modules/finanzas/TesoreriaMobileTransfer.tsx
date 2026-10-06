import { useState } from 'react';
import { Box, Button, IconButton, InputBase, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import type { FinanzasCuenta, FinanzasOperacion, TransferenciaUpdatePayload } from '../../types/finanzas';
import { MAIN_NAV_TYPE } from '../../theme/tokens';
import { actualizarTransferencia, crearTransferencia, eliminarTransferencia } from '../../services/finanzasService';
import { fechaCivil, limpiarMonto } from './capturaMovimientoLogica';
import { movimientoEliminable } from './seleccionMovimientos';
import { detalleCuenta, formatearMoneda } from './tesoreriaMobilePresentacion';
import { etiquetaFechaMovil, TesoreriaMobileFecha, TesoreriaMobileSelector } from './TesoreriaMobileSelector';
import { validarTransferencia } from './transferenciaLogica';

type Pantalla = 'form' | 'origen' | 'destino' | 'fecha';

type Props = {
  cuentas: FinanzasCuenta[];
  cuentaOrigenId: number | null;
  transferencia: TransferenciaUpdatePayload | null;
  operacion: FinanzasOperacion | null;
  onBack: () => void;
  onGuardada: () => Promise<void> | void;
  onAviso: (mensaje: string, severity: 'success' | 'error' | 'info') => void;
};

export function TesoreriaMobileTransfer({
  cuentas,
  cuentaOrigenId,
  transferencia,
  operacion,
  onBack,
  onGuardada,
  onAviso,
}: Props) {
  const theme = useTheme();
  const tokens = theme.emphasys;
  const [pantalla, setPantalla] = useState<Pantalla>('form');
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [origenId, setOrigenId] = useState<number | null>(transferencia?.cuenta_origen_id ?? cuentaOrigenId);
  const [destinoId, setDestinoId] = useState<number | null>(transferencia?.cuenta_destino_id ?? null);
  const [monto, setMonto] = useState(transferencia ? String(Math.abs(Number(transferencia.monto) || 0) || '') : '');
  const [fecha, setFecha] = useState(transferencia?.fecha ? String(transferencia.fecha).slice(0, 10) : fechaCivil());
  const [referencia, setReferencia] = useState(transferencia?.referencia || '');
  const [observaciones] = useState(transferencia?.observaciones || '');
  const [montoEnfocado, setMontoEnfocado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const origen = cuentas.find((cuenta) => cuenta.id === origenId) || null;
  const destino = cuentas.find((cuenta) => cuenta.id === destinoId) || null;
  const moneda = origen?.moneda || 'MXN';
  const resultado = validarTransferencia({
    cuentaOrigenId: origenId,
    cuentaDestinoId: destinoId,
    fecha,
    monto,
    referencia,
    observaciones,
  });
  const puedeEliminar = Boolean(operacion && movimientoEliminable(operacion) && operacion.transferencia_id);

  const guardar = async () => {
    if (guardando || !resultado.ok) {
      if (!resultado.ok) setError(resultado.mensaje);
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      if (transferencia?.id) await actualizarTransferencia(transferencia.id, resultado.payload);
      else await crearTransferencia(resultado.payload);
      await onGuardada();
      onAviso(transferencia ? 'Transferencia actualizada' : 'Transferencia registrada', 'success');
      onBack();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la transferencia');
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    if (!operacion?.transferencia_id || !movimientoEliminable(operacion)) return;
    const confirmar = window.confirm('Esta acción eliminará el movimiento seleccionado. Las transferencias se eliminan completas, en las dos cuentas.');
    if (!confirmar) return;
    try {
      await eliminarTransferencia(operacion.transferencia_id);
      await onGuardada();
      onAviso('Movimiento eliminado', 'success');
      onBack();
    } catch (err: unknown) {
      onAviso(err instanceof Error ? err.message : 'No se pudo eliminar', 'error');
    }
  };

  if (pantalla === 'origen' || pantalla === 'destino') {
    return (
      <TesoreriaMobileSelector
        titulo={pantalla === 'origen' ? 'Desde' : 'Hacia'}
        seleccionadoId={pantalla === 'origen' ? origenId : destinoId}
        onBack={() => setPantalla('form')}
        onSelect={(opcion) => {
          if (pantalla === 'origen') setOrigenId(opcion.id);
          else setDestinoId(opcion.id);
          setPantalla('form');
        }}
        opciones={cuentas.map((cuenta) => ({
          id: cuenta.id,
          titulo: cuenta.identificador,
          detalle: detalleCuenta(cuenta),
        }))}
      />
    );
  }
  if (pantalla === 'fecha') {
    return (
      <TesoreriaMobileFecha
        fecha={fecha}
        onBack={() => setPantalla('form')}
        onSelect={(valor) => {
          setFecha(valor);
          setPantalla('form');
        }}
      />
    );
  }

  const montoVisible = !monto ? '' : montoEnfocado ? monto : formatearMoneda(Number(limpiarMonto(monto)) || 0, moneda);

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', fontFamily: MAIN_NAV_TYPE.fontFamily, bgcolor: tokens.content.background }}>
      <Box sx={{ px: 0.5, minHeight: 52, display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
        <IconButton aria-label="Volver" onClick={onBack} disabled={guardando} sx={{ width: 40, height: 40, color: tokens.content.foreground }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography noWrap sx={{ flex: 1, fontSize: 18, fontWeight: 650, letterSpacing: '-0.02em', color: tokens.content.foreground }}>
          Transferencia
        </Typography>
        {puedeEliminar ? (
          <IconButton aria-label="Más acciones" onClick={(event) => setMenuAnchor(event.currentTarget)} sx={{ width: 40, height: 40, color: tokens.content.foreground }}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        ) : null}
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          slotProps={{ paper: { sx: { bgcolor: tokens.content.elevated, color: tokens.content.foreground, border: `1px solid ${tokens.content.border}` } } }}
        >
          <MenuItem onClick={() => { setMenuAnchor(null); void eliminar(); }} sx={{ fontFamily: 'inherit', color: tokens.action.destructive }}>
            <ListItemIcon><DeleteOutlineIcon fontSize="small" sx={{ color: tokens.action.destructive }} /></ListItemIcon>
            <ListItemText>Eliminar</ListItemText>
          </MenuItem>
        </Menu>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Fila etiqueta="Desde" valor={origen?.identificador || ''} onClick={() => setPantalla('origen')} />
        <Fila etiqueta="Hacia" valor={destino?.identificador || ''} onClick={() => setPantalla('destino')} />
        <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${tokens.content.border}` }}>
          <Typography sx={{ fontSize: 12, color: tokens.content.muted }}>Monto</Typography>
          <InputBase
            value={montoVisible}
            onChange={(event) => setMonto(limpiarMonto(event.target.value))}
            onFocus={() => setMontoEnfocado(true)}
            onBlur={() => setMontoEnfocado(false)}
            placeholder={formatearMoneda(0, moneda)}
            inputProps={{ inputMode: 'decimal', 'aria-label': 'Monto' }}
            sx={{
              width: '100%',
              fontFamily: theme.typography.figure?.fontFamily,
              fontSize: 36,
              letterSpacing: '-0.03em',
              color: tokens.content.foreground,
              '& input::placeholder': { color: tokens.content.muted, opacity: 1 },
            }}
          />
        </Box>
        <Fila etiqueta="Fecha" valor={etiquetaFechaMovil(fecha)} onClick={() => setPantalla('fecha')} />
        <Box sx={{ px: 2, py: 1.2 }}>
          <Typography sx={{ fontSize: 12, color: tokens.content.muted }}>Nota</Typography>
          <InputBase
            value={referencia}
            onChange={(event) => setReferencia(event.target.value)}
            placeholder="Opcional"
            multiline
            inputProps={{ 'aria-label': 'Nota' }}
            sx={{ width: '100%', mt: 0.25, fontFamily: 'inherit', fontSize: 16, color: tokens.content.foreground }}
          />
        </Box>
      </Box>

      <Box sx={{ flexShrink: 0, px: 2, pt: 1.25, pb: 'calc(12px + env(safe-area-inset-bottom))', borderTop: `1px solid ${tokens.content.border}`, bgcolor: tokens.content.background }}>
        {error ? (
          <Typography role="alert" sx={{ mb: 1, fontSize: 13, color: tokens.action.destructive }}>{error}</Typography>
        ) : null}
        <Button
          fullWidth
          disabled={!resultado.ok || guardando}
          onClick={() => { void guardar(); }}
          sx={{
            textTransform: 'none',
            fontFamily: 'inherit',
            fontWeight: 650,
            fontSize: 16,
            borderRadius: '12px',
            py: 1.15,
            boxShadow: 'none',
            bgcolor: tokens.action.primary,
            color: tokens.action.primaryForeground,
            '&:hover': { bgcolor: tokens.action.primaryHover, boxShadow: 'none' },
            '&.Mui-disabled': { bgcolor: tokens.action.disabled, color: tokens.action.primaryForeground },
          }}
        >
          {guardando ? 'Transfiriendo…' : 'Transferir'}
        </Button>
      </Box>
    </Box>
  );
}

function Fila({ etiqueta, valor, onClick }: { etiqueta: string; valor: string; onClick: () => void }) {
  const tokens = useTheme().emphasys;
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 2,
        py: 1.15,
        border: 0,
        borderBottom: `1px solid ${tokens.content.border}`,
        bgcolor: 'transparent',
        font: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
        '&:active': { bgcolor: tokens.content.hover },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 12, color: tokens.content.muted }}>{etiqueta}</Typography>
        <Typography noWrap sx={{ fontSize: 16, fontWeight: 600, color: valor ? tokens.content.foreground : tokens.content.muted }}>
          {valor || 'Elegir'}
        </Typography>
      </Box>
      <ChevronRightIcon sx={{ color: tokens.content.muted }} />
    </Box>
  );
}
