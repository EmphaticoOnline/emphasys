import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  InputBase,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DriveFileMoveOutlinedIcon from '@mui/icons-material/DriveFileMoveOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import type { FinanzasCuenta, FinanzasOperacion, TipoMovimiento } from '../../types/finanzas';
import { MAIN_NAV_TYPE } from '../../theme/tokens';
import { crearOperacion, eliminarOperacion, eliminarTransferencia, subirAdjuntoOperacion } from '../../services/finanzasService';
import { validarOperacionGeneral } from './capturaMovimientoLogica';
import { movimientoDuplicable, movimientoEliminable, movimientoMovible } from './seleccionMovimientos';
import { detalleCuenta, formatearMoneda } from './tesoreriaMobilePresentacion';
import { etiquetaFechaConcreta, TesoreriaMobileFecha, TesoreriaMobileSelector, type OpcionSelector } from './TesoreriaMobileSelector';
import { TesoreriaMobileAdjuntos } from './TesoreriaMobileAdjuntos';
import { useTesoreriaMovimientoForm } from './useTesoreriaMovimientoForm';

type Pantalla = 'form' | 'cuenta' | 'contacto' | 'concepto' | 'fecha' | 'adjuntos';

type Props = {
  operacion: FinanzasOperacion | null;
  cuentas: FinanzasCuenta[];
  cuentaInicialId: number | null;
  onBack: () => void;
  onRefresh: (cuentaId: number) => Promise<void> | void;
  onAviso: (mensaje: string, severity: 'success' | 'error' | 'info') => void;
};

export function TesoreriaMobileMovementEditor({
  operacion,
  cuentas,
  cuentaInicialId,
  onBack,
  onRefresh,
  onAviso,
}: Props) {
  const theme = useTheme();
  const tokens = theme.emphasys;
  const form = useTesoreriaMovimientoForm({ operacion, cuentaInicialId, cuentas, onGuardada: onRefresh });
  const [pantalla, setPantalla] = useState<Pantalla>('form');
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [montoEnfocado, setMontoEnfocado] = useState(false);
  const [pendientes, setPendientes] = useState<File[]>([]);
  const [conteoAdjuntos, setConteoAdjuntos] = useState(
    Number((operacion as (FinanzasOperacion & { adjuntos_count?: number }) | null)?.adjuntos_count) || 0,
  );
  const montoRef = useRef<HTMLInputElement | null>(null);
  const archivoRef = useRef<HTMLInputElement | null>(null);
  const cuenta = cuentas.find((item) => item.id === form.cuentaId) || null;
  const moneda = cuenta?.moneda || 'MXN';
  const monedaBase = cuentas.find((item) => item.id === (operacion?.cuenta_id ?? cuentaInicialId))?.moneda || moneda;
  const cuentasVisibles = useMemo(
    () => cuentas.filter((item) => {
      if (item.id === form.cuentaId) return true;
      if (item.cuenta_cerrada) return false;
      return (item.moneda || 'MXN') === (monedaBase || 'MXN');
    }),
    [cuentas, form.cuentaId, monedaBase],
  );
  const puedeMover = Boolean(operacion && movimientoMovible(operacion) && cuentasVisibles.some((item) => item.id !== operacion.cuenta_id));
  const puedeDuplicar = Boolean(operacion && movimientoDuplicable(operacion));
  const puedeEliminar = Boolean(operacion && movimientoEliminable(operacion));
  const totalAdjuntos = conteoAdjuntos + pendientes.length;

  useLayoutEffect(() => {
    if (operacion) return;
    montoRef.current?.focus();
  }, [operacion]);

  const recibirArchivos = async (lista: FileList | null) => {
    const archivos = Array.from(lista || []);
    if (!archivos.length) return;
    const operacionId = form.idPersistida;
    if (!operacionId) {
      setPendientes((actuales) => [...actuales, ...archivos]);
      return;
    }
    try {
      for (const archivo of archivos) await subirAdjuntoOperacion(operacionId, archivo);
      setConteoAdjuntos((actual) => actual + archivos.length);
      if (form.cuentaId) void onRefresh(form.cuentaId);
    } catch (err: unknown) {
      form.setError(err instanceof Error ? err.message : 'No se pudo agregar el archivo');
    }
  };

  const elegir = (siguiente: Pantalla) => (opcion: OpcionSelector) => {
    if (siguiente === 'cuenta') form.setCuentaId(opcion.id);
    if (siguiente === 'contacto') {
      const elegida = form.opcionesContacto.find((item) => item.clave === opcion.clave);
      if (elegida) form.seleccionarContacto(elegida);
    }
    if (siguiente === 'concepto') form.setConceptoId(opcion.id);
    setPantalla('form');
  };

  const guardar = async () => {
    const guardado = await form.guardar();
    if (guardado == null) return;
    const aviso = guardado.tipo === 'transferencia'
      ? (form.transferenciaId ? 'Transferencia actualizada' : 'Transferencia registrada')
      : (operacion ? 'Operación actualizada' : 'Operación registrada');
    if (guardado.tipo === 'transferencia' && !form.idPersistida && pendientes.length) {
      setPendientes([]);
      onAviso('Transferencia registrada. Los archivos no se adjuntaron: un adjunto pertenece a una operación, no a la transferencia.', 'info');
      onBack();
      return;
    }
    const id = guardado.tipo === 'operacion' ? guardado.id : form.idPersistida;
    if (!pendientes.length || id == null) {
      onAviso(aviso, 'success');
      onBack();
      return;
    }
    const fallos: File[] = [];
    for (const archivo of pendientes) {
      try {
        await subirAdjuntoOperacion(id, archivo);
      } catch {
        fallos.push(archivo);
      }
    }
    if (fallos.length) {
      setPendientes(fallos);
      form.setError(`El movimiento se guardó, pero fallaron ${fallos.length} archivo(s). Puedes reintentarlo.`);
      return;
    }
    setPendientes([]);
    onAviso(aviso, 'success');
    onBack();
  };

  const duplicar = async () => {
    if (!operacion || !movimientoDuplicable(operacion)) return;
    const resultado = validarOperacionGeneral(operacion);
    if (!resultado.ok) {
      onAviso(resultado.mensaje, 'error');
      return;
    }
    try {
      await crearOperacion(resultado.payload);
      await onRefresh(operacion.cuenta_id);
      onAviso('Movimiento duplicado', 'success');
    } catch (err: unknown) {
      onAviso(err instanceof Error ? err.message : 'No se pudo duplicar', 'error');
    }
  };

  const eliminar = async () => {
    if (!operacion || !movimientoEliminable(operacion)) return;
    const confirmar = window.confirm(
      operacion.transferencia_id
        ? 'Esta acción eliminará la transferencia completa, en las dos cuentas.'
        : 'Esta acción eliminará el movimiento seleccionado.',
    );
    if (!confirmar) return;
    try {
      if (operacion.transferencia_id) await eliminarTransferencia(operacion.transferencia_id);
      else await eliminarOperacion(operacion.id);
      await onRefresh(operacion.cuenta_id);
      onAviso('Movimiento eliminado', 'success');
      onBack();
    } catch (err: unknown) {
      onAviso(err instanceof Error ? err.message : 'No se pudo eliminar', 'error');
    }
  };

  if (pantalla === 'cuenta') {
    return (
      <TesoreriaMobileSelector
        titulo="Cuenta"
        seleccionadoId={form.cuentaId}
        onBack={() => setPantalla('form')}
        onSelect={elegir('cuenta')}
        opciones={cuentasVisibles.map((item) => ({
          id: item.id,
          titulo: item.identificador,
          detalle: detalleCuenta(item),
        }))}
      />
    );
  }
  if (pantalla === 'contacto') {
    return (
      <TesoreriaMobileSelector
        titulo="Contacto"
        seleccionadoId={form.contactoId}
        seleccionadoClave={form.claveContacto}
        onBack={() => setPantalla('form')}
        onSelect={elegir('contacto')}
        opciones={form.opcionesContacto.map((item) => ({
          id: item.tipo === 'contacto' ? item.contactoId : item.cuentaId,
          titulo: item.etiqueta,
          clave: item.clave,
          variante: item.tipo === 'transferencia' ? 'transferencia' as const : 'normal' as const,
        }))}
      />
    );
  }
  if (pantalla === 'concepto') {
    return (
      <TesoreriaMobileSelector
        titulo="Concepto"
        seleccionadoId={form.conceptoId}
        onBack={() => setPantalla('form')}
        onSelect={elegir('concepto')}
        opciones={form.conceptos.map((item) => ({ id: item.id, titulo: item.nombre_concepto }))}
      />
    );
  }
  if (pantalla === 'fecha') {
    return (
      <TesoreriaMobileFecha
        fecha={form.fecha}
        onBack={() => setPantalla('form')}
        onSelect={(valor) => {
          form.setFecha(valor);
          setPantalla('form');
        }}
      />
    );
  }
  if (pantalla === 'adjuntos') {
    return (
      <TesoreriaMobileAdjuntos
        operacionId={form.idPersistida}
        pendientes={pendientes}
        onPendientes={setPendientes}
        onConteo={setConteoAdjuntos}
        onMutacion={() => {
          if (form.cuentaId) void onRefresh(form.cuentaId);
        }}
        onBack={() => setPantalla('form')}
      />
    );
  }

  const montoVisible = !form.monto
    ? ''
    : montoEnfocado
      ? form.monto
      : formatearMoneda(Number(form.monto) || 0, moneda);

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', fontFamily: MAIN_NAV_TYPE.fontFamily, bgcolor: tokens.content.background }}>
      <Box sx={{ px: 0.5, minHeight: 52, display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
        <IconButton aria-label="Volver" onClick={onBack} disabled={form.guardando} sx={iconoSx(tokens)}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography noWrap sx={{ flex: 1, fontSize: 18, fontWeight: 650, letterSpacing: '-0.02em', color: tokens.content.foreground }}>
          {operacion ? 'Editar movimiento' : 'Nuevo movimiento'}
        </Typography>
        {operacion ? (
          <IconButton aria-label="Más acciones" onClick={(event) => setMenuAnchor(event.currentTarget)} sx={iconoSx(tokens)}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        ) : null}
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          slotProps={{ paper: { sx: { bgcolor: tokens.content.elevated, color: tokens.content.foreground, border: `1px solid ${tokens.content.border}`, minWidth: 220 } } }}
        >
          {puedeDuplicar ? (
            <MenuItem onClick={() => { setMenuAnchor(null); void duplicar(); }} sx={{ fontFamily: 'inherit' }}>
              <ListItemIcon><ContentCopyOutlinedIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Duplicar</ListItemText>
            </MenuItem>
          ) : null}
          {puedeMover ? (
            <MenuItem onClick={() => { setMenuAnchor(null); setPantalla('cuenta'); }} sx={{ fontFamily: 'inherit' }}>
              <ListItemIcon><DriveFileMoveOutlinedIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Mover a otra cuenta</ListItemText>
            </MenuItem>
          ) : null}
          {puedeEliminar ? (
            <MenuItem onClick={() => { setMenuAnchor(null); void eliminar(); }} sx={{ fontFamily: 'inherit', color: tokens.action.destructive }}>
              <ListItemIcon><DeleteOutlineIcon fontSize="small" sx={{ color: tokens.action.destructive }} /></ListItemIcon>
              <ListItemText>Eliminar</ListItemText>
            </MenuItem>
          ) : null}
        </Menu>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', pb: 2 }}>
        <Box
          onClick={() => montoRef.current?.focus()}
          sx={{
            mx: 2,
            mt: 2,
            px: 1.25,
            pt: 2.5,
            pb: 1.5,
            borderRadius: '16px',
            bgcolor: montoEnfocado ? tokens.content.elevated : tokens.content.hover,
            boxShadow: montoEnfocado ? `inset 0 0 0 1.5px ${tokens.content.foreground}` : 'none',
            cursor: 'text',
          }}
        >
          <InputBase
            inputRef={montoRef}
            value={montoVisible}
            onChange={(event) => form.setMonto(event.target.value.replace(/[^0-9.]/g, ''))}
            onFocus={() => {
              setMontoEnfocado(true);
              if (form.monto) form.setMonto(form.monto.replace(/[^0-9.]/g, ''));
            }}
            onBlur={() => setMontoEnfocado(false)}
            placeholder="0.00"
            inputProps={{ inputMode: 'decimal', 'aria-label': 'Monto', enterKeyHint: 'done' }}
            sx={{
              width: '100%',
              '& input': {
                fontFamily: theme.typography.figure?.fontFamily,
                fontSize: 'clamp(40px, 12vw, 52px) !important',
                fontWeight: 500,
                lineHeight: 1,
                letterSpacing: '-0.03em',
                textAlign: 'center',
                fontVariantNumeric: 'tabular-nums',
                color: tokens.content.foreground,
                caretColor: tokens.content.foreground,
                p: 0,
              },
              '& input::placeholder': { color: tokens.content.muted, opacity: 1 },
            }}
          />
          <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', p: 0.35, gap: 0.35, borderRadius: '12px', bgcolor: tokens.content.background }}>
            {(['Retiro', 'Deposito'] as TipoMovimiento[]).map((opcion) => {
              const activo = form.tipo === opcion;
              return (
                <Box
                  key={opcion}
                  component="button"
                  type="button"
                  disabled={form.modoTransferencia}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (form.modoTransferencia) return;
                    form.setTipo(opcion);
                  }}
                  sx={{
                    border: 0,
                    borderRadius: '10px',
                    py: 0.8,
                    font: 'inherit',
                    fontSize: 15,
                    fontWeight: 650,
                    cursor: form.modoTransferencia ? 'default' : 'pointer',
                    bgcolor: activo ? tokens.action.primary : 'transparent',
                    color: activo ? tokens.action.primaryForeground : tokens.content.secondary,
                    opacity: form.modoTransferencia && !activo ? 0.45 : 1,
                  }}
                >
                  {opcion === 'Deposito' ? 'Depósito' : 'Retiro'}
                </Box>
              );
            })}
          </Box>
        </Box>

        <Box sx={{ mt: 2 }}>
          <Fila etiqueta="Cuenta" valor={cuenta?.identificador || ''} placeholder="Elegir cuenta" onClick={() => setPantalla('cuenta')} />
          <Fila etiqueta="Contacto" valor={form.contactoNombre} placeholder="Seleccionar contacto" onClick={() => setPantalla('contacto')} />
          <Fila
            etiqueta="Concepto"
            valor={form.conceptoNombre}
            placeholder="Seleccionar concepto"
            deshabilitada={form.modoTransferencia}
            onClick={() => {
              if (form.modoTransferencia) return;
              setPantalla('concepto');
            }}
          />
          <Fila etiqueta="Fecha" valor={etiquetaFechaConcreta(form.fecha)} placeholder="Elegir fecha" onClick={() => setPantalla('fecha')} />
        </Box>

        <Box sx={{ px: 2, py: 1.2, borderBottom: `1px solid ${tokens.content.border}` }}>
          <Typography sx={{ fontSize: 12, color: tokens.content.muted }}>
            {form.referenciaObligatoria ? 'Nota / referencia *' : 'Nota / referencia'}
          </Typography>
          <InputBase
            value={form.referencia}
            onChange={(event) => form.setReferencia(event.target.value)}
            placeholder={form.referenciaObligatoria ? 'Requerida para este método' : 'Opcional'}
            multiline
            inputProps={{ 'aria-label': 'Nota o referencia' }}
            sx={{
              width: '100%',
              mt: 0.25,
              fontFamily: 'inherit',
              fontSize: 16,
              color: tokens.content.foreground,
              '& textarea::placeholder': { color: tokens.content.muted, opacity: 1 },
            }}
          />
        </Box>

        <input
          ref={archivoRef}
          hidden
          type="file"
          multiple
          accept="image/*,application/pdf"
          onChange={(event) => {
            void recibirArchivos(event.target.files);
            event.target.value = '';
          }}
        />
        <Fila
          etiqueta="Adjuntos"
          valor={totalAdjuntos > 0 ? `${totalAdjuntos} ${totalAdjuntos === 1 ? 'archivo' : 'archivos'}` : ''}
          placeholder="Agregar archivo"
          onClick={() => {
            if (totalAdjuntos === 0) {
              archivoRef.current?.click();
              return;
            }
            setPantalla('adjuntos');
          }}
        />
      </Box>

      <Box sx={{ flexShrink: 0, px: 2, pt: 1.25, pb: 'calc(12px + env(safe-area-inset-bottom))', borderTop: `1px solid ${tokens.content.border}`, bgcolor: tokens.content.background }}>
        {form.error ? (
          <Typography role="alert" sx={{ mb: 1, fontSize: 13, color: tokens.action.destructive }}>
            {form.error}
          </Typography>
        ) : null}
        <Button
          fullWidth
          disabled={!form.listo || form.guardando}
          onClick={() => { void guardar(); }}
          sx={botonGuardarSx(tokens)}
        >
          {form.guardando ? 'Guardando…' : 'Guardar'}
        </Button>
      </Box>
    </Box>
  );
}

function Fila({ etiqueta, valor, placeholder, onClick, deshabilitada = false }: { etiqueta: string; valor: string; placeholder: string; onClick: () => void; deshabilitada?: boolean }) {
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
        color: 'inherit',
        font: 'inherit',
        textAlign: 'left',
        cursor: deshabilitada ? 'default' : 'pointer',
        opacity: deshabilitada ? 0.72 : 1,
        WebkitTapHighlightColor: 'transparent',
        '&:active': { bgcolor: deshabilitada ? 'transparent' : tokens.content.hover },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 12, color: tokens.content.muted }}>{etiqueta}</Typography>
        <Typography noWrap sx={{ fontSize: 16, fontWeight: 600, color: valor ? tokens.content.foreground : tokens.content.muted }}>
          {valor || placeholder}
        </Typography>
      </Box>
      <ChevronRightIcon sx={{ color: tokens.content.muted }} />
    </Box>
  );
}

function iconoSx(tokens: { content: { foreground: string; hover: string } }) {
  return { width: 40, height: 40, color: tokens.content.foreground, '&:hover': { bgcolor: tokens.content.hover } };
}

function botonGuardarSx(tokens: { action: { primary: string; primaryForeground: string; primaryHover: string; disabled: string } }) {
  return {
    textTransform: 'none' as const,
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
  };
}
