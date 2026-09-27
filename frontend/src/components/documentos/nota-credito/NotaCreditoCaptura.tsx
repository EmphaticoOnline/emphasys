import { useEffect, useMemo, useState } from 'react';
import type { Theme } from '@mui/material/styles';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Menu,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined';
import PostAddOutlinedIcon from '@mui/icons-material/PostAddOutlined';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import TratamientoFiscalControl from '../TratamientoFiscalControl';
import type { TratamientoImpuestos } from '../../../types/cotizacion';
import type { Contacto } from '../../../types/contactos.types';
import type { Concepto } from '../../../types/finanzas';
import type { PrepararGeneracionResponse } from '../../../services/documentGenerationService';

const MENSAJE_PARTIDAS_INCOMPATIBLES = 'Solo pueden combinarse partidas compatibles en la misma nota.';

export type MotivoNotaCreditoCaptura = 'devolucion' | 'bonificacion' | 'otro';

export type FilaNotaCredito = {
  partidaId: number;
  documentoId: number;
  folio: string;
  fecha: string;
  clave: string;
  descripcion: string;
  facturado: number;
  devuelto: number;
  disponible: number;
  precio: number;
  base: number;
  maximo: number;
};

export type CandidataNotaCredito = FilaNotaCredito & {
  tratamiento: TratamientoImpuestos;
};

type NotaCreditoCapturaProps = {
  tituloCliente: string;
  clienteNombre: string;
  contactos: Contacto[];
  clienteId: number | null;
  onCliente: (contacto: Contacto | null) => void;
  clienteBloqueado: boolean;
  fecha: string;
  onFecha: (value: string) => void;
  motivo: MotivoNotaCreditoCaptura;
  onMotivo: (value: MotivoNotaCreditoCaptura) => void;
  motivoBloqueado: boolean;
  referencia: string;
  onReferencia: (value: string) => void;
  muestraPartidas: boolean;
  filas: FilaNotaCredito[];
  valores: Record<number, number>;
  onValor: (partidaId: number, valor: number) => void;
  onQuitar?: (partidaId: number) => void;
  puedeQuitar: boolean;
  onAgregar?: (seleccion: CandidataNotaCredito[]) => void;
  cargarCandidatas?: (() => Promise<CandidataNotaCredito[]>) | undefined;
  tratamiento: TratamientoImpuestos | null | undefined;
  tratamientoIndeterminado?: boolean;
  onTratamiento: (value: TratamientoImpuestos) => void;
  tratamientoBloqueado: boolean;
  conceptos: Concepto[];
  conceptoId: number | null;
  onConcepto: (id: number | null) => void;
  importe: string;
  onImporte: (value: string) => void;
  onImporteFocus: () => void;
  onImporteBlur: () => void;
  subtotal: number;
  iva: number;
  total: number;
  folioOrigen?: string | null | undefined;
  soloLectura: boolean;
  guardando: boolean;
  onGuardar: () => void;
  onCancelar: () => void;
  usuarioPreferenciasId?: number | null;
};

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

const headSx = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: (theme: Theme) => theme.emphasys.table.headerFg,
  bgcolor: (theme: Theme) => theme.emphasys.table.headerBg,
  borderBottom: (theme: Theme) => `1px solid ${theme.emphasys.table.line}`,
  py: 0.7,
  px: 1.25,
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
};

const headCapturaSx = {
  ...headSx,
  textTransform: 'none',
  letterSpacing: 0,
  fontSize: 12,
  fontWeight: 800,
  color: 'primary.main',
  bgcolor: (theme: Theme) => theme.emphasys.action.wash,
};

const cellSx = {
  fontSize: 13,
  color: (theme: Theme) => theme.emphasys.table.cell,
  borderBottom: (theme: Theme) => `1px solid ${theme.emphasys.table.line}`,
  py: 0.3,
  px: 1.25,
  fontVariantNumeric: 'tabular-nums',
};

const numHeadSx = {
  ...headSx,
  width: '1%',
  px: 0.75,
  letterSpacing: '0.04em',
};

const numCellSx = {
  ...cellSx,
  width: '1%',
  px: 0.75,
  whiteSpace: 'nowrap',
};

const idHeadSx = {
  ...headSx,
  width: '1%',
  px: 1,
  whiteSpace: 'nowrap',
};

const idCellSx = {
  ...cellSx,
  width: '1%',
  px: 1,
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'normal',
};

const capturaHeadSx = {
  ...headCapturaSx,
  width: '1%',
  px: 0.75,
  whiteSpace: 'nowrap',
};

function fondoFila(index: number) {
  return index % 2 === 0 ? '#fff' : '#f4f6f8';
}

function CeldaFactura({ folio, fecha }: { folio: string; fecha: string }) {
  const fechaCorta = formatFecha(fecha);
  return (
    <TableCell sx={idCellSx}>
      <Tooltip title={fechaCorta || folio} placement="top" enterDelay={250}>
        <Box
          component="span"
          sx={{
            fontSize: 13,
            fontWeight: 700,
            color: 'primary.main',
            cursor: 'help',
            borderBottom: '1px dotted #94a3b8',
            lineHeight: 1.2,
          }}
        >
          {folio}
        </Box>
      </Tooltip>
    </TableCell>
  );
}

function CeldaClave({ clave }: { clave: string }) {
  return (
    <TableCell sx={idCellSx}>
      <Box component="span" sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.01em', color: '#1e293b' }}>
        {clave || '—'}
      </Box>
    </TableCell>
  );
}

function CeldaProducto({
  descripcion,
  activo,
  onQuitar,
}: {
  descripcion: string;
  activo: boolean;
  onQuitar?: (() => void) | undefined;
}) {
  return (
    <TableCell sx={{ ...cellSx, fontVariantNumeric: 'normal', width: '99%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 28 }}>
        <Typography
          title={descripcion}
          sx={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            fontWeight: activo ? 600 : 500,
            color: activo ? '#0f172a' : '#334155',
            lineHeight: 1.25,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {descripcion}
        </Typography>
        {onQuitar && (
          <Tooltip title="Quitar de la nota de crédito" placement="top">
            <IconButton
              size="small"
              aria-label="Quitar de la nota de crédito"
              onClick={onQuitar}
              sx={{
                flexShrink: 0,
                width: 28,
                height: 28,
                color: '#dc2626',
                '&:hover': { color: '#b91c1c', bgcolor: 'rgba(220, 38, 38, 0.08)' },
              }}
            >
              <RemoveCircleOutlineIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </TableCell>
  );
}

function CeldaNumero({ children, color, peso }: { children: string; color?: string; peso?: number }) {
  return (
    <TableCell align="right" sx={{ ...numCellSx, color: color ?? '#334155', fontWeight: peso ?? 500 }}>
      {children}
    </TableCell>
  );
}

function BotonTope({ valor, titulo, onClick }: { valor: string; titulo: string; onClick: () => void }) {
  return (
    <Box
      component="button"
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={onClick}
      sx={{
        border: 0,
        p: 0,
        m: 0,
        width: '100%',
        bgcolor: 'transparent',
        cursor: 'pointer',
        font: 'inherit',
        fontSize: 13,
        fontWeight: 700,
        color: 'primary.main',
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
        '&:hover': { textDecoration: 'underline' },
      }}
    >
      {valor}
    </Box>
  );
}

function formatCantidad(value: number) {
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 }).format(value);
}

function formatFecha(value: string) {
  if (!value) return '';
  const [year, month, day] = value.slice(0, 10).split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function parseNumero(raw: string) {
  const compacto = raw.trim().replace(/,/g, '');
  if (!compacto) return 0;
  const parsed = Number(compacto);
  return Number.isFinite(parsed) ? parsed : null;
}

function fraseCaptura(folios: string[], capturadas: number) {
  if (capturadas === 0) return 'Nada capturado todavía';
  const partidas = `${capturadas} ${capturadas === 1 ? 'partida' : 'partidas'}`;
  if (folios.length <= 1) return `${partidas} en ${folios[0] ?? ''}`.trim();
  const previa = folios.slice(0, -1).join(', ');
  return `${partidas} en ${previa} y ${folios[folios.length - 1]}`;
}

export default function NotaCreditoCaptura({
  tituloCliente,
  clienteNombre,
  contactos,
  clienteId,
  onCliente,
  clienteBloqueado,
  fecha,
  onFecha,
  motivo,
  onMotivo,
  motivoBloqueado,
  referencia,
  onReferencia,
  muestraPartidas,
  filas,
  valores,
  onValor,
  onQuitar,
  puedeQuitar,
  onAgregar,
  cargarCandidatas,
  tratamiento,
  tratamientoIndeterminado = false,
  onTratamiento,
  tratamientoBloqueado,
  conceptos,
  conceptoId,
  onConcepto,
  importe,
  onImporte,
  onImporteFocus,
  onImporteBlur,
  subtotal,
  iva,
  total,
  folioOrigen,
  soloLectura,
  guardando,
  onGuardar,
  onCancelar,
  usuarioPreferenciasId = null,
}: NotaCreditoCapturaProps) {
  const [dialogo, setDialogo] = useState(false);
  const [cargandoCandidatas, setCargandoCandidatas] = useState(false);
  const [candidatas, setCandidatas] = useState<CandidataNotaCredito[]>([]);
  const [seleccionDialogo, setSeleccionDialogo] = useState<number[]>([]);
  const [errorDialogo, setErrorDialogo] = useState('');
  const [busquedaDialogo, setBusquedaDialogo] = useState('');
  const [ordenDialogo, setOrdenDialogo] = useState<{ campo: 'fecha' | 'producto'; direccion: 'asc' | 'desc' }>({ campo: 'fecha', direccion: 'asc' });
  const [columnasDialogo, setColumnasDialogo] = useState({ factura: true, fecha: true, clave: true, descripcion: true, disponible: true, maximo: true });
  const [columnasAnchor, setColumnasAnchor] = useState<HTMLElement | null>(null);
  const columnasStorageKey = `emphasys:nc:modal-partidas:columnas:${usuarioPreferenciasId ?? 'anonimo'}`;
  const ordenStorageKey = `emphasys:nc:modal-partidas:orden:${usuarioPreferenciasId ?? 'anonimo'}`;
  const cliente = contactos.find((item) => item.id === clienteId) ?? null;
  const concepto = conceptos.find((item) => item.id === conceptoId) ?? null;
  const devolucion = motivo === 'devolucion';

  useEffect(() => {
    try {
      const columnas = JSON.parse(localStorage.getItem(columnasStorageKey) || 'null');
      if (columnas && typeof columnas === 'object') setColumnasDialogo((prev) => ({ ...prev, ...columnas }));
      const orden = JSON.parse(localStorage.getItem(ordenStorageKey) || 'null');
      if (orden?.campo === 'fecha' || orden?.campo === 'producto') setOrdenDialogo({ campo: orden.campo, direccion: orden.direccion === 'desc' ? 'desc' : 'asc' });
    } catch {
      // Las preferencias de interfaz no deben bloquear la captura.
    }
  }, [columnasStorageKey, ordenStorageKey]);

  const actualizarColumnas = (nombre: keyof typeof columnasDialogo) => {
    setColumnasDialogo((prev) => {
      const next = { ...prev, [nombre]: !prev[nombre] };
      try {
        localStorage.setItem(columnasStorageKey, JSON.stringify(next));
      } catch {
        // Las preferencias de interfaz no deben bloquear la captura.
      }
      return next;
    });
  };

  const actualizarOrden = (campo: 'fecha' | 'producto') => {
    setOrdenDialogo((prev) => {
      const next = { campo, direccion: prev.campo === campo && prev.direccion === 'asc' ? 'desc' : 'asc' };
      try {
        localStorage.setItem(ordenStorageKey, JSON.stringify(next));
      } catch {
        // Las preferencias de interfaz no deben bloquear la captura.
      }
      return next;
    });
  };

  const candidatasVisibles = useMemo(() => {
    const termino = busquedaDialogo.trim().toLocaleLowerCase();
    const filtradas = candidatas.filter((fila) => {
      if (!termino) return true;
      return [fila.folio, fila.clave, fila.descripcion]
        .some((valor) => String(valor ?? '').toLocaleLowerCase().includes(termino));
    });
    const direccion = ordenDialogo.direccion === 'asc' ? 1 : -1;
    return [...filtradas].sort((a, b) => {
      if (ordenDialogo.campo === 'fecha') {
        return String(a.fecha).localeCompare(String(b.fecha)) * direccion;
      }
      return `${a.clave} ${a.descripcion}`.localeCompare(
        `${b.clave} ${b.descripcion}`,
        'es-MX',
        { numeric: true, sensitivity: 'base' },
      ) * direccion;
    });
  }, [busquedaDialogo, candidatas, ordenDialogo]);

  const resumen = useMemo(() => {
    let problemas = 0;
    const usadas = filas.filter((fila) => {
      const valor = Number(valores[fila.partidaId] ?? 0);
      const tope = devolucion ? fila.disponible : fila.maximo;
      if (valor > tope + 0.000001) {
        problemas += 1;
        return false;
      }
      return valor > 0;
    });
    const folios = Array.from(new Set(usadas.map((fila) => fila.folio)));
    return { capturadas: usadas.length, problemas, folios, texto: fraseCaptura(folios, usadas.length) };
  }, [devolucion, filas, valores]);
  const detalleProblema = resumen.problemas > 0
    ? ` · ${resumen.problemas} ${resumen.problemas === 1 ? 'excede' : 'exceden'} ${devolucion ? 'lo disponible' : 'el máximo'}`
    : '';

  const abrirDialogo = async () => {
    if (!cargarCandidatas) return;
    setDialogo(true);
    setCargandoCandidatas(true);
    setErrorDialogo('');
    setSeleccionDialogo([]);
    setBusquedaDialogo('');
    try {
      const data = await cargarCandidatas();
      setCandidatas(data);
    } catch (error) {
      setCandidatas([]);
      setErrorDialogo(error instanceof Error ? error.message : 'No se pudieron cargar las facturas compatibles.');
    } finally {
      setCargandoCandidatas(false);
    }
  };

  const cerrarDialogo = () => {
    window.setTimeout(() => setDialogo(false), 0);
  };

  const aceptarDialogo = () => {
    const elegidas = candidatas.filter((fila) => seleccionDialogo.includes(fila.partidaId));
    onAgregar?.(elegidas);
    cerrarDialogo();
  };

  const encabezado = (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: motivo === 'otro' ? 'minmax(0, 1.4fr) 150px 160px minmax(140px, 1fr) auto' : 'minmax(0, 1.4fr) 150px 180px minmax(140px, 1fr)',
        gap: 1.25,
        alignItems: 'start',
      }}
    >
      <Autocomplete
        options={contactos}
        value={cliente}
        disabled={clienteBloqueado || soloLectura}
        onChange={(_, value) => onCliente(value)}
        getOptionLabel={(option) => option.nombre || ''}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        renderInput={(params) => (
          <TextField
            {...params}
            label={tituloCliente}
            size="small"
            InputLabelProps={{ shrink: true }}
          />
        )}
      />
      <TextField
        label="Fecha"
        type="date"
        size="small"
        value={fecha}
        disabled={soloLectura}
        onChange={(event) => onFecha(event.target.value)}
        InputLabelProps={{ shrink: true }}
      />
      <TextField
        select
        label="Motivo"
        size="small"
        value={motivo}
        disabled={motivoBloqueado || soloLectura}
        onChange={(event) => onMotivo(event.target.value as MotivoNotaCreditoCaptura)}
        InputLabelProps={{ shrink: true }}
      >
        <MenuItem value="devolucion">Devolución</MenuItem>
        <MenuItem value="bonificacion">Bonificación</MenuItem>
        <MenuItem value="otro">Otro</MenuItem>
      </TextField>
      <TextField
        label="Referencia"
        size="small"
        value={referencia}
        disabled={soloLectura || !clienteId}
        onChange={(event) => onReferencia(event.target.value)}
        InputLabelProps={{ shrink: true }}
      />
      {motivo === 'otro' && (
        <TratamientoFiscalControl value={tratamiento} onChange={onTratamiento} disabled={tratamientoBloqueado || soloLectura} mostrarEtiqueta={false} />
      )}
    </Box>
  );

  const pie = (
    <PieNotaCredito
      detalle={motivo === 'otro' ? 'Sin factura origen' : resumen.texto}
      detalleProblema={motivo === 'otro' ? '' : detalleProblema}
      problemas={motivo === 'otro' ? 0 : resumen.problemas}
      subtotal={subtotal}
      iva={iva}
      total={total}
      adherido={motivo === 'otro' || Boolean(clienteId)}
      guardando={guardando}
      soloLectura={soloLectura}
      onGuardar={onGuardar}
      onCancelar={onCancelar}
    />
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100dvh - 210px)', minHeight: 0, overflow: 'hidden', px: { xs: 1, sm: 2, md: 3 }, pt: { xs: 1.5, sm: 2, md: 2.5 } }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25, flexShrink: 0 }}>
        <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'primary.main', letterSpacing: '-0.02em' }}>Nota de crédito</Typography>
        {folioOrigen ? (
          <Chip
            size="small"
            label={`Desde factura ${folioOrigen}`}
            sx={{ height: 22, fontSize: 11, fontWeight: 700, color: '#fff', bgcolor: 'primary.main' }}
          />
        ) : null}
        {clienteNombre && motivo !== 'otro' ? (
          <Typography sx={{ fontSize: 13, color: '#64748b' }}>{clienteNombre}</Typography>
        ) : null}
      </Stack>

      <Paper
        variant="outlined"
        sx={{
          flexShrink: 0,
          p: { xs: 1.5, md: 2 },
          borderColor: '#d7dde7',
          bgcolor: '#fff',
          borderRadius: motivo === 'otro' ? '8px 8px 0 0' : 2,
          borderBottom: motivo === 'otro' ? 'none' : undefined,
        }}
      >
        {encabezado}
        {motivo === 'otro' && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) 200px' }, gap: 1.5, mt: 1.5 }}>
            <Autocomplete
              options={conceptos.filter((item) => item.activo !== false)}
              value={concepto}
              disabled={soloLectura || !clienteId}
              onChange={(_, value) => onConcepto(value?.id ?? null)}
              getOptionLabel={(option) => option.nombre_concepto || ''}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => (
                <TextField {...params} label="Concepto" size="small" placeholder="Selecciona un concepto" InputLabelProps={{ shrink: true }} />
              )}
            />
            <TextField
              label="Importe"
              size="small"
              value={importe}
              disabled={soloLectura || !clienteId}
              onChange={(event) => onImporte(event.target.value)}
              onFocus={onImporteFocus}
              onBlur={onImporteBlur}
              placeholder="0.00"
              autoComplete="off"
              InputLabelProps={{ shrink: true }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start" sx={{ '& .MuiTypography-root': { fontWeight: 700 } }}>
                    $
                  </InputAdornment>
                ),
              }}
              inputProps={{
                inputMode: 'decimal',
                style: { textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
              }}
            />
          </Box>
        )}
      </Paper>

      {motivo === 'otro' && pie}

      {muestraPartidas && (
        <Box sx={{ mt: 2.5, flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} useFlexGap flexWrap="wrap" sx={{ flexShrink: 0, mb: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1.5} useFlexGap>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'primary.main' }}>
              {devolucion ? 'Partidas a devolver' : 'Partidas a bonificar'}
            </Typography>
              {cargarCandidatas && !soloLectura && (
                <Tooltip title="Agregar partidas de otras facturas" placement="top">
                  <span>
                    <IconButton
                      size="small"
                      aria-label="Agregar partidas de otras facturas"
                      onClick={() => void abrirDialogo()}
                      disabled={!clienteId}
                      sx={{ width: 32, height: 32, color: 'primary.main', '&:hover': { bgcolor: (theme: Theme) => theme.emphasys.action.hoverTint } }}
                    >
                      <PostAddOutlinedIcon sx={{ fontSize: 22 }} />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </Stack>
            {clienteId && (
              <Typography sx={{ fontSize: 13, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                {resumen.capturadas} de {filas.length}
              </Typography>
            )}
          </Stack>

          {!clienteId ? (
            <Paper
              variant="outlined"
              sx={{ borderStyle: 'dashed', borderColor: '#d7dde7', borderRadius: 2, py: 7, px: 3, textAlign: 'center', bgcolor: '#fff', flexShrink: 0 }}
            >
              <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'primary.main' }}>Selecciona un {tituloCliente.toLowerCase()}</Typography>
              <Typography sx={{ mt: 0.75, fontSize: 13, color: '#64748b' }}>
                Después podrás elegir partidas de todas sus facturas compatibles.
              </Typography>
            </Paper>
          ) : (
            <Paper
              variant="outlined"
              sx={{
                borderRadius: '8px 8px 0 0',
                borderColor: '#d7dde7',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                flex: '0 1 auto',
                minHeight: 0,
                borderBottom: 'none',
              }}
            >
              <Box sx={{ overflow: 'auto', minHeight: 0, flex: '1 1 auto' }}>
                <Table stickyHeader size="small" sx={{ width: '100%', minWidth: devolucion ? 860 : 760 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={idHeadSx}>Factura</TableCell>
                      <TableCell sx={idHeadSx}>Clave</TableCell>
                      <TableCell sx={{ ...headSx, width: '99%' }}>Descripción</TableCell>
                      {devolucion ? (
                        <>
                          <TableCell align="right" sx={numHeadSx}>Facturado</TableCell>
                          <TableCell align="right" sx={numHeadSx}>Devuelto</TableCell>
                          <TableCell align="right" title="Clic en el número para capturar todo lo disponible" sx={numHeadSx}>Disponible</TableCell>
                          <TableCell align="right" sx={capturaHeadSx}>A devolver</TableCell>
                          <TableCell align="right" sx={numHeadSx}>Precio</TableCell>
                          <TableCell align="right" sx={numHeadSx}>Importe</TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell align="right" sx={numHeadSx}>Base</TableCell>
                          <TableCell align="right" title="Clic en el monto para capturar el máximo" sx={numHeadSx}>Máximo</TableCell>
                          <TableCell align="right" sx={{ ...capturaHeadSx, whiteSpace: 'normal', lineHeight: 1.15, width: 118 }}>
                            Monto a bonificar
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filas.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={devolucion ? 9 : 6} sx={{ ...cellSx, py: 3, color: '#64748b', textAlign: 'center' }}>
                          Esta nota no tiene partidas. Puedes agregarlas desde otras facturas del cliente.
                        </TableCell>
                      </TableRow>
                    )}
                    {filas.map((fila, index) => {
                      const valor = Number(valores[fila.partidaId] ?? 0);
                      const tope = devolucion ? fila.disponible : fila.maximo;
                      const excede = valor > tope + 0.000001;
                      const activo = valor > 0 && !excede;
                      const importeLinea = devolucion
                        ? (fila.disponible > 0 ? (Math.min(valor, fila.disponible) / fila.disponible) * fila.maximo : 0)
                        : Math.min(valor, fila.maximo);
                      return (
                        <TableRow key={fila.partidaId} sx={{ bgcolor: fondoFila(index) }}>
                          <CeldaFactura folio={fila.folio} fecha={fila.fecha} />
                          <CeldaClave clave={fila.clave} />
                          <CeldaProducto
                            descripcion={fila.descripcion}
                            activo={activo}
                            onQuitar={puedeQuitar && onQuitar ? () => onQuitar(fila.partidaId) : undefined}
                          />
                          {devolucion ? (
                            <>
                              <CeldaNumero>{formatCantidad(fila.facturado)}</CeldaNumero>
                              <CeldaNumero color={fila.devuelto > 0 ? '#9a3412' : '#94a3b8'} peso={fila.devuelto > 0 ? 700 : 500}>
                                {formatCantidad(fila.devuelto)}
                              </CeldaNumero>
                              <TableCell align="right" sx={numCellSx}>
                                {soloLectura ? (
                                  <Box component="span" sx={{ fontWeight: 700, color: 'primary.main' }}>{formatCantidad(fila.disponible)}</Box>
                                ) : (
                                  <BotonTope
                                    valor={formatCantidad(fila.disponible)}
                                    titulo={`Devolver ${formatCantidad(fila.disponible)} disponibles`}
                                    onClick={() => onValor(fila.partidaId, fila.disponible)}
                                  />
                                )}
                              </TableCell>
                              <TableCell align="right" sx={numCellSx}>
                                <Captura
                                  valor={valor}
                                  invalido={excede}
                                  disabled={soloLectura}
                                  ariaLabel={`A devolver de ${fila.descripcion}`}
                                  width={72}
                                  onCommit={(next) => onValor(fila.partidaId, next)}
                                />
                              </TableCell>
                              <CeldaNumero color="#475569">{money.format(fila.precio)}</CeldaNumero>
                              <TableCell align="right" sx={numCellSx}>
                                {activo ? (
                                  <Box component="span" sx={{ fontWeight: 700, color: 'primary.main' }}>{money.format(importeLinea)}</Box>
                                ) : (
                                  <Box component="span" sx={{ fontWeight: 700, color: excede ? '#c2410c' : '#cbd5e1' }}>
                                    {excede ? 'Excede' : '—'}
                                  </Box>
                                )}
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <CeldaNumero color="#475569">{money.format(fila.base)}</CeldaNumero>
                              <TableCell align="right" sx={numCellSx}>
                                {soloLectura ? (
                                  <Box component="span" sx={{ fontWeight: 700, color: 'primary.main' }}>{money.format(fila.maximo)}</Box>
                                ) : (
                                  <BotonTope
                                    valor={money.format(fila.maximo)}
                                    titulo={`Bonificar el máximo ${money.format(fila.maximo)}`}
                                    onClick={() => onValor(fila.partidaId, fila.maximo)}
                                  />
                                )}
                              </TableCell>
                              <TableCell align="right" sx={numCellSx}>
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                  <Captura
                                    valor={valor}
                                    invalido={excede}
                                    disabled={soloLectura}
                                    dinero
                                    ariaLabel={`Monto a bonificar de ${fila.descripcion}`}
                                    width={108}
                                    onCommit={(next) => onValor(fila.partidaId, next)}
                                  />
                                  {excede && (
                                    <Typography sx={{ mt: 0.35, fontSize: 11, fontWeight: 700, color: '#c2410c' }}>Excede</Typography>
                                  )}
                                </Box>
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Box>
            </Paper>
          )}
          {pie}
        </Box>
      )}

      <Dialog open={dialogo} onClose={cerrarDialogo} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 700, color: 'primary.main' }}>Agregar partidas de otras facturas</DialogTitle>
        <DialogContent>
          {errorDialogo ? <Typography color="error" sx={{ mb: 1 }}>{errorDialogo}</Typography> : null}
          {cargandoCandidatas ? <Typography>Cargando partidas…</Typography> : null}
          {!cargandoCandidatas && candidatas.length === 0 && !errorDialogo ? (
            <Typography color="text.secondary">No hay partidas compatibles disponibles.</Typography>
          ) : null}
          {new Set(candidatas.map((fila) => fila.tratamiento)).size > 1 && (
            <Typography sx={{ fontSize: 12, color: '#64748b', mb: 1 }}>
              {MENSAJE_PARTIDAS_INCOMPATIBLES}
            </Typography>
          )}
          {candidatas.length > 0 && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1.25, alignItems: { sm: 'center' } }}>
              <TextField
                size="small"
                fullWidth
                value={busquedaDialogo}
                onChange={(event) => setBusquedaDialogo(event.target.value)}
                placeholder="Buscar por factura, clave o descripción"
                inputProps={{ 'aria-label': 'Buscar partidas' }}
              />
              <TextField
                select
                size="small"
                label="Ordenar por"
                value={ordenDialogo.campo}
                onChange={(event) => {
                  const campo = event.target.value as 'fecha' | 'producto';
                  setOrdenDialogo((prev) => {
                    const next = { campo, direccion: prev.campo === campo ? prev.direccion : 'asc' };
                    try {
                      localStorage.setItem(ordenStorageKey, JSON.stringify(next));
                    } catch {
                      // Las preferencias de interfaz no deben bloquear la captura.
                    }
                    return next;
                  });
                }}
                sx={{ minWidth: 135 }}
              >
                <MenuItem value="fecha">Fecha</MenuItem>
                <MenuItem value="producto">Producto</MenuItem>
              </TextField>
              <Tooltip title={ordenDialogo.direccion === 'asc' ? 'Ascendente' : 'Descendente'}>
                <IconButton size="small" onClick={() => actualizarOrden(ordenDialogo.campo)} aria-label="Cambiar dirección del orden">
                  {ordenDialogo.direccion === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Organizar columnas">
                <IconButton size="small" onClick={(event) => setColumnasAnchor(event.currentTarget)} aria-label="Organizar columnas">
                  <ViewColumnOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Menu anchorEl={columnasAnchor} open={Boolean(columnasAnchor)} onClose={() => setColumnasAnchor(null)}>
                {[
                  ['factura', 'Factura'],
                  ['fecha', 'Fecha'],
                  ['clave', 'Clave'],
                  ['descripcion', 'Descripción'],
                  ['disponible', 'Disponible'],
                  ...(!devolucion ? [['maximo', 'Máximo']] : []),
                ].map(([nombre, etiqueta]) => (
                  <MenuItem key={nombre} onClick={() => actualizarColumnas(nombre as keyof typeof columnasDialogo)}>
                    <Checkbox size="small" checked={columnasDialogo[nombre as keyof typeof columnasDialogo]} tabIndex={-1} />
                    <Typography variant="body2">{etiqueta}</Typography>
                  </MenuItem>
                ))}
              </Menu>
            </Stack>
          )}
          {candidatas.length > 0 && candidatasVisibles.length === 0 && (
            <Typography color="text.secondary" sx={{ mb: 1 }}>No se encontraron partidas.</Typography>
          )}
          {candidatas.length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  {columnasDialogo.factura && <TableCell sx={headSx}>Factura</TableCell>}
                  {columnasDialogo.fecha && <TableCell sx={headSx}>Fecha</TableCell>}
                  {columnasDialogo.clave && <TableCell sx={headSx}>Clave</TableCell>}
                  {columnasDialogo.descripcion && <TableCell sx={headSx}>Descripción</TableCell>}
                  {columnasDialogo.disponible && <TableCell sx={headSx}>Disponible</TableCell>}
                  {!devolucion && columnasDialogo.maximo && <TableCell sx={headSx}>Máximo</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {candidatasVisibles.map((fila) => {
                  const marcada = seleccionDialogo.includes(fila.partidaId);
                  const tratamientoElegido = candidatas.find((item) => seleccionDialogo.includes(item.partidaId))?.tratamiento;
                  const incompatible = Boolean(tratamientoElegido) && fila.tratamiento !== tratamientoElegido;
                  return (
                    <TableRow
                      key={fila.partidaId}
                      hover
                      onClick={() => {
                        if (incompatible) return;
                        setSeleccionDialogo((prev) => (marcada ? prev.filter((id) => id !== fila.partidaId) : [...prev, fila.partidaId]));
                      }}
                      sx={{ cursor: incompatible ? 'not-allowed' : 'pointer', opacity: incompatible ? 0.45 : 1 }}
                    >
                      <TableCell padding="checkbox" onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          size="small"
                          checked={marcada}
                          disabled={incompatible}
                          onChange={() => {
                            if (incompatible) return;
                            setSeleccionDialogo((prev) => (marcada ? prev.filter((id) => id !== fila.partidaId) : [...prev, fila.partidaId]));
                          }}
                        />
                      </TableCell>
                      {columnasDialogo.factura && <TableCell>{fila.folio}</TableCell>}
                      {columnasDialogo.fecha && <TableCell>{formatFecha(fila.fecha)}</TableCell>}
                      {columnasDialogo.clave && <TableCell>{fila.clave || '—'}</TableCell>}
                      {columnasDialogo.descripcion && <TableCell>{fila.descripcion}</TableCell>}
                      {columnasDialogo.disponible && <TableCell align="right">{formatCantidad(fila.disponible)}</TableCell>}
                      {!devolucion && columnasDialogo.maximo ? <TableCell align="right">{money.format(fila.maximo)}</TableCell> : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={cerrarDialogo}>Cancelar</Button>
          <Button variant="contained" disabled={seleccionDialogo.length === 0} onClick={aceptarDialogo} sx={{ bgcolor: 'primary.main' }}>
            Agregar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function Captura({
  valor,
  invalido,
  disabled,
  dinero,
  ariaLabel,
  width,
  onCommit,
}: {
  valor: number;
  invalido: boolean;
  disabled: boolean;
  dinero?: boolean;
  ariaLabel: string;
  width: number;
  onCommit: (valor: number) => void;
}) {
  const [texto, setTexto] = useState(valor > 0 ? String(valor) : '');
  const [enfocado, setEnfocado] = useState(false);
  const activo = valor > 0 && !invalido;
  const visible = enfocado ? texto : (valor > 0 ? (dinero ? valor.toFixed(2) : String(valor)) : '');
  return (
    <TextField
      value={visible}
      disabled={disabled}
      size="small"
      hiddenLabel
      placeholder={dinero ? '0.00' : '0'}
      autoComplete="off"
      onFocus={(event) => {
        setEnfocado(true);
        setTexto(valor > 0 ? String(valor) : '');
        const input = event.target;
        requestAnimationFrame(() => input.select());
      }}
      onChange={(event) => {
        setTexto(event.target.value);
        const parsed = parseNumero(event.target.value);
        if (parsed != null && parsed >= 0) onCommit(parsed);
      }}
      onBlur={() => {
        setEnfocado(false);
        const parsed = parseNumero(texto);
        onCommit(parsed != null && parsed > 0 ? parsed : 0);
      }}
      inputProps={{ 'aria-label': ariaLabel, inputMode: 'decimal' }}
      {...(dinero
        ? {
            InputProps: {
              startAdornment: (
                <Box component="span" sx={{ fontSize: 12, fontWeight: 700, color: activo ? 'primary.main' : '#94a3b8', pl: 0.75 }}>
                  $
                </Box>
              ),
            },
          }
        : {})}
      sx={{
        width,
        '& .MuiOutlinedInput-root': {
          height: 28,
          bgcolor: '#fff',
          borderRadius: '6px',
          '& fieldset': { borderColor: invalido ? '#d97706' : activo ? 'primary.main' : '#d5dce6' },
          '&:hover fieldset': { borderColor: invalido ? '#d97706' : 'primary.main' },
          '&.Mui-focused fieldset': { borderWidth: 1.5, borderColor: invalido ? '#d97706' : 'primary.main' },
        },
        '& .MuiOutlinedInput-input': {
          py: 0,
          px: 1,
          textAlign: 'right',
          fontWeight: 700,
          fontSize: 13,
          color: invalido ? '#9a3412' : activo ? 'primary.main' : '#64748b',
          fontVariantNumeric: 'tabular-nums',
          '&::placeholder': { color: '#c5cdd8', opacity: 1, fontWeight: 600 },
        },
      }}
    />
  );
}

function TotalDato({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <Box sx={{ textAlign: 'right', minWidth: emphasis ? 112 : 84 }}>
      <Typography
        sx={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: emphasis ? 'primary.main' : '#8b93a7',
          lineHeight: 1,
          mb: 0.45,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: emphasis ? 22 : 14,
          fontWeight: emphasis ? 800 : 600,
          color: emphasis ? 'primary.main' : '#334155',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: emphasis ? '-0.02em' : 0,
          lineHeight: 1.05,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function PieNotaCredito({
  detalle,
  detalleProblema,
  problemas,
  subtotal,
  iva,
  total,
  adherido,
  guardando,
  soloLectura,
  onGuardar,
  onCancelar,
}: {
  detalle: string;
  detalleProblema: string;
  problemas: number;
  subtotal: number;
  iva: number;
  total: number;
  adherido: boolean;
  guardando: boolean;
  soloLectura: boolean;
  onGuardar: () => void;
  onCancelar: () => void;
}) {
  return (
    <Paper
      elevation={0}
      sx={adherido ? {
        flexShrink: 0,
        px: { xs: 1.5, md: 2 },
        py: 1,
        borderRadius: '0 0 8px 8px',
        border: '1px solid #d7dde7',
        borderTop: '1px solid #e5eaf1',
        bgcolor: '#fff',
        boxShadow: 'none',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 2,
      } : {
        mt: 2,
        px: { xs: 1.5, md: 2 },
        py: 1.25,
        borderRadius: 2,
        border: '1px solid #d7dde7',
        bgcolor: '#fff',
        boxShadow: (theme: Theme) => `0 10px 28px ${theme.emphasys.action.hoverTint}`,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <Typography
        sx={{
          flex: '1 1 220px',
          fontSize: 13,
          fontWeight: 600,
          color: problemas > 0 ? '#9a3412' : '#475569',
          minWidth: 180,
        }}
      >
        {detalle}
        {detalleProblema}
      </Typography>
      <Stack direction="row" spacing={2.5} alignItems="flex-end" useFlexGap flexWrap="wrap">
        <TotalDato label="Subtotal" value={money.format(subtotal)} />
        <TotalDato label="IVA" value={money.format(iva)} />
        <Box sx={{ width: '1px', alignSelf: 'stretch', bgcolor: '#e5eaf1' }} />
        <TotalDato label="Total" value={money.format(total)} emphasis />
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center">
        <Button
          variant="outlined"
          onClick={onCancelar}
          disabled={guardando}
          sx={{
            height: 40,
            px: 2,
            textTransform: 'none',
            fontWeight: 600,
            color: '#334155',
            borderColor: '#cbd5e1',
            '&:hover': { borderColor: '#94a3b8', bgcolor: '#f8fafc' },
          }}
        >
          Cancelar
        </Button>
        <Button
          variant="contained"
          disableElevation
          onClick={onGuardar}
          disabled={guardando || soloLectura}
          sx={{
            height: 40,
            px: 2.25,
            textTransform: 'none',
            fontWeight: 700,
            bgcolor: 'primary.main',
            whiteSpace: 'nowrap',
            '&:hover': { bgcolor: 'primary.dark' },
          }}
        >
          Guardar
        </Button>
      </Stack>
    </Paper>
  );
}

export function filasDesdePreparacion(
  partidas: PrepararGeneracionResponse['partidas'],
  opciones: {
    incluidas: number[];
    documentos: Array<{ id: number; serie?: string | null; numero?: number | null; fecha_documento?: string | null }>;
    productos: Array<{ id: number; clave?: string | null; descripcion?: string | null }>;
    devolucion: boolean;
    ajustePropio?: Record<number, { cantidadVinculada: number; montoCapturado: number }>;
  }
): FilaNotaCredito[] {
  const porDocumento = new Map(opciones.documentos.map((doc) => [Number(doc.id), doc]));
  const porProducto = new Map(opciones.productos.map((producto) => [Number(producto.id), producto]));
  const incluidas = new Set(opciones.incluidas);
  return partidas
    .filter((partida) => incluidas.has(partida.partida_id))
    .map((partida) => {
      const ajuste = opciones.ajustePropio?.[partida.partida_id];
      const devuelto = Math.max(0, Number(partida.cantidad_ya_generada ?? 0) - Number(ajuste?.cantidadVinculada ?? 0));
      const disponible = Number((Number(partida.cantidad_pendiente_sugerida ?? 0) + Number(ajuste?.cantidadVinculada ?? 0)).toFixed(6));
      const maximo = Number((Number(partida.importe_maximo_sugerido ?? 0) + Number(ajuste?.montoCapturado ?? 0)).toFixed(2));
      const origen = Number(partida.cantidad_origen ?? 0);
      const base = disponible > 0 ? Number((maximo * (origen / disponible)).toFixed(2)) : maximo;
      const documento = porDocumento.get(Number(partida.documento_origen_id));
      const producto = partida.producto_id ? porProducto.get(Number(partida.producto_id)) : null;
      return {
        partidaId: partida.partida_id,
        documentoId: Number(partida.documento_origen_id),
        folio: partida.documento_origen_folio || `${documento?.serie ?? ''}${documento?.numero ?? ''}`,
        fecha: String(documento?.fecha_documento ?? '').slice(0, 10),
        clave: producto?.clave || '',
        descripcion: producto?.descripcion || partida.descripcion || '',
        facturado: origen,
        devuelto,
        disponible,
        precio: Number(partida.precio_unitario ?? 0),
        base,
        maximo,
      };
    })
    .filter((fila) => (opciones.devolucion ? fila.disponible > 0.000001 : fila.maximo > 0.000001));
}
