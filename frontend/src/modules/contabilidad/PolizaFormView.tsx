import * as React from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import type { TipoPoliza } from '../../types/tiposPoliza';
import type { CuentaAfectable, PolizaEncabezadoInput } from '../../types/polizas';
import { fetchTiposPoliza } from '../../services/tiposPolizaService';
import { fetchCuentasAfectables } from '../../services/contabilidadService';
import { fetchConceptos } from '../../services/conceptosService';
import {
  fetchPoliza,
  fetchSiguienteNumero,
  crearPoliza,
  actualizarPoliza,
} from '../../services/polizasService';
import {
  bandaCapturaSx,
  botonPrimarioSx,
  botonSecundarioSx,
  encabezadoTablaSx,
  filaTotalesTablaSx,
  iconoPeligroSx,
  panelSx,
  seccionLabelSx,
  tablaCapturaSx,
  tituloVistaSx,
} from './contabilidadVisual';

// Fecha civil de "hoy" sin pasar por toISOString() (que se calcula en UTC y
// puede desfasar un día según la zona horaria del navegador). Mismo patrón
// ya usado en otras páginas del proyecto (ej. ConciliacionBancariaPage).
function hoyISO(): string {
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function formatMoneda(valor: number): string {
  return valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
}

// Cargo/Abono: mientras el campo tiene foco se muestra tal cual se captura
// (sin separador de miles, para no romper la posición del cursor); al perder
// el foco se reformatea con separador de miles para lectura rápida.
function formatImporteCelda(valor: string, enfocado: boolean): string {
  if (enfocado || !valor) return valor;
  const numero = Number(valor);
  if (Number.isNaN(numero)) return valor;
  return numero.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Banda de encabezado (Tipo/Número/Fecha/Estatus/Referencia/Observaciones):
// variant="standard" sin línea (disableUnderline) para que el campo se vea
// como una celda de captura, no como un TextField de formulario. El label
// flotante de MUI se reemplaza por una leyenda fija arriba del campo (ver
// CampoBanda) para evitar que se monte feo sobre el borde al compactar.
const bandaInputSx = {
  '& .MuiInputBase-root': { fontSize: 13, minHeight: 0 },
  '& .MuiInputBase-input': { padding: '2px 2px' },
  '& .MuiSelect-select': { padding: '2px 2px !important', fontSize: 13 },
};

// Celda editable de la grilla de movimientos: mismo criterio (standard +
// disableUnderline) para que Cargo/Abono/UUID/RFC se sientan celdas de hoja
// de cálculo y no inputs de formulario.
const celdaInputSx = {
  '& .MuiInputBase-root': { fontSize: 13, minHeight: 0 },
  '& .MuiInputBase-input': { padding: '6px 4px', fontVariantNumeric: 'tabular-nums' },
};

// Autocomplete agrega su propio padding interno y botones de flecha/limpiar
// (endAdornment) que, sin recortar, quedan más altos que el texto y son la
// causa principal de que la fila crezca por encima de una celda compacta.
const celdaAutocompleteSx = {
  ...celdaInputSx,
  '& .MuiAutocomplete-input': { padding: '6px 2px !important' },
  '& .MuiAutocomplete-endAdornment': { right: 0, top: 'calc(50% - 9px)' },
  '& .MuiAutocomplete-popupIndicator, & .MuiAutocomplete-clearIndicator': { padding: 2 },
  '& .MuiAutocomplete-popupIndicator .MuiSvgIcon-root, & .MuiAutocomplete-clearIndicator .MuiSvgIcon-root': {
    fontSize: 15,
  },
};

const compactTableSx = tablaCapturaSx;

// Leyenda fija (no label flotante) arriba de cada campo de la banda de
// encabezado: evita el problema de labels de MUI montándose sobre el borde
// al reducir la altura del control.
function CampoBanda({
  label,
  width,
  children,
}: {
  label: string;
  width?: number | string;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ width, minWidth: width, flex: width ? '0 0 auto' : 1, display: 'flex', flexDirection: 'column' }}>
      <Typography
        sx={seccionLabelSx}
      >
        {label}
      </Typography>
      {children}
    </Box>
  );
}

interface ConceptoOpcion {
  id: number;
  nombre_concepto: string;
}

interface MovimientoFormRow {
  id: string;
  cuenta: CuentaAfectable | null;
  concepto: ConceptoOpcion | null;
  cargo: string;
  abono: string;
  uuid_cfdi: string;
  rfc: string;
}

interface EncabezadoFormState {
  tipo_poliza_id: number | '';
  fecha: string;
  referencia: string;
  observaciones: string;
  estatus: 'borrador' | 'aplicada';
}

export default function PolizaFormView({
  polizaId,
  onCancel,
  onSaved,
}: {
  polizaId: number | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const isEdit = polizaId != null;
  const contadorRenglon = React.useRef(0);

  const [loadingInicial, setLoadingInicial] = React.useState(true);
  const [tiposPoliza, setTiposPoliza] = React.useState<TipoPoliza[]>([]);
  const [cuentasAfectables, setCuentasAfectables] = React.useState<CuentaAfectable[]>([]);
  const [conceptos, setConceptos] = React.useState<ConceptoOpcion[]>([]);

  const [form, setForm] = React.useState<EncabezadoFormState>({
    tipo_poliza_id: '',
    fecha: hoyISO(),
    referencia: '',
    observaciones: '',
    estatus: 'borrador',
  });
  const [numeroInfo, setNumeroInfo] = React.useState<{ numero: number; ejercicio: number; periodo: number } | null>(null);
  const [movimientos, setMovimientos] = React.useState<MovimientoFormRow[]>([]);
  const [filaActivaId, setFilaActivaId] = React.useState<string | null>(null);
  const [campoImporteEnfocado, setCampoImporteEnfocado] = React.useState<string | null>(null);

  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>(
    { open: false, message: '', severity: 'info' }
  );

  function crearRenglonVacio(): MovimientoFormRow {
    contadorRenglon.current += 1;
    return {
      id: `nuevo-${contadorRenglon.current}`,
      cuenta: null,
      concepto: null,
      cargo: '',
      abono: '',
      uuid_cfdi: '',
      rfc: '',
    };
  }

  React.useEffect(() => {
    let cancelado = false;
    setLoadingInicial(true);

    Promise.all([
      fetchTiposPoliza(true),
      fetchCuentasAfectables(),
      fetchConceptos(),
      isEdit && polizaId ? fetchPoliza(polizaId) : Promise.resolve(null),
    ])
      .then(([tipos, cuentas, conceptosData, polizaData]) => {
        if (cancelado) return;
        setTiposPoliza(tipos);
        setCuentasAfectables(cuentas);
        const opcionesConcepto: ConceptoOpcion[] = conceptosData.map((c) => ({ id: c.id, nombre_concepto: c.nombre_concepto }));
        setConceptos(opcionesConcepto);

        if (polizaData) {
          const { encabezado, movimientos: movs } = polizaData;
          setForm({
            tipo_poliza_id: encabezado.tipo_poliza_id,
            fecha: encabezado.fecha,
            referencia: encabezado.referencia ?? '',
            observaciones: encabezado.observaciones ?? '',
            estatus: encabezado.estatus === 'aplicada' ? 'aplicada' : 'borrador',
          });
          setNumeroInfo({ numero: encabezado.numero, ejercicio: encabezado.ejercicio, periodo: encabezado.periodo });
          setMovimientos(
            movs.map((m) => {
              const conceptoOpcion = m.concepto_id
                ? opcionesConcepto.find((c) => c.id === m.concepto_id) ?? { id: m.concepto_id, nombre_concepto: m.concepto_descripcion ?? '' }
                : null;
              return {
                id: `existente-${m.id}`,
                cuenta: cuentas.find((c) => c.id === m.cuenta_id) ?? { id: m.cuenta_id, cuenta: m.cuenta, descripcion: m.cuenta_descripcion },
                concepto: conceptoOpcion,
                cargo: m.cargo ? String(m.cargo) : '',
                abono: m.abono ? String(m.abono) : '',
                uuid_cfdi: m.uuid_cfdi ?? '',
                rfc: m.rfc ?? '',
              };
            })
          );
        }
      })
      .catch((err: any) => {
        if (!cancelado) setFormError(err?.message || 'No se pudo cargar la información necesaria');
      })
      .finally(() => {
        if (!cancelado) setLoadingInicial(false);
      });

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polizaId, isEdit]);

  // Número sugerido: solo aplica en alta; en edición ya viene fijo del
  // encabezado cargado y no se debe recalcular.
  React.useEffect(() => {
    if (isEdit) return;
    if (!form.tipo_poliza_id || !form.fecha) {
      setNumeroInfo(null);
      return;
    }
    let cancelado = false;
    fetchSiguienteNumero(Number(form.tipo_poliza_id), form.fecha)
      .then((info) => {
        if (!cancelado) setNumeroInfo(info);
      })
      .catch(() => {
        if (!cancelado) setNumeroInfo(null);
      });
    return () => {
      cancelado = true;
    };
  }, [form.tipo_poliza_id, form.fecha, isEdit]);

  const handleChangeForm = (campo: keyof EncabezadoFormState, valor: string) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  };

  const actualizarMovimiento = (id: string, cambios: Partial<Omit<MovimientoFormRow, 'id'>>) => {
    setMovimientos((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const actualizado: MovimientoFormRow = { ...m, ...cambios };
        if (cambios.cargo !== undefined && Number(cambios.cargo) > 0) {
          actualizado.abono = '';
        }
        if (cambios.abono !== undefined && Number(cambios.abono) > 0) {
          actualizado.cargo = '';
        }
        return actualizado;
      })
    );
  };

  const handleAgregarMovimiento = () => {
    setMovimientos((prev) => [...prev, crearRenglonVacio()]);
  };

  const handleEliminarMovimiento = (id: string) => {
    setMovimientos((prev) => prev.filter((m) => m.id !== id));
    setFilaActivaId((prev) => (prev === id ? null : prev));
  };

  const totalCargos = React.useMemo(
    () => movimientos.reduce((acc, m) => acc + (Number(m.cargo) || 0), 0),
    [movimientos]
  );
  const totalAbonos = React.useMemo(
    () => movimientos.reduce((acc, m) => acc + (Number(m.abono) || 0), 0),
    [movimientos]
  );
  const diferencia = Number((totalCargos - totalAbonos).toFixed(2));
  const cuadrada = Math.abs(diferencia) < 0.005;

  const handleCuadrar = () => {
    if (cuadrada) {
      setSnackbar({ open: true, message: 'La póliza ya está cuadrada.', severity: 'info' });
      return;
    }

    setMovimientos((prev) => {
      let index = filaActivaId ? prev.findIndex((m) => m.id === filaActivaId) : -1;
      if (index === -1) {
        index = prev.findIndex((m) => !Number(m.cargo) && !Number(m.abono));
      }

      let copia = prev;
      if (index === -1) {
        copia = [...prev, crearRenglonVacio()];
        index = copia.length - 1;
      } else {
        copia = [...prev];
      }

      const filaActual = copia[index];
      if (!filaActual) return prev;

      const monto = Math.abs(diferencia).toFixed(2);
      const fila: MovimientoFormRow = { ...filaActual };
      if (diferencia > 0) {
        fila.abono = monto;
        fila.cargo = '';
      } else {
        fila.cargo = monto;
        fila.abono = '';
      }
      copia[index] = fila;
      return copia;
    });
  };

  function validarAntesDeGuardar(estatusDestino: 'borrador' | 'aplicada'): string | null {
    if (!form.tipo_poliza_id) return 'El tipo de póliza es obligatorio';
    if (!form.fecha) return 'La fecha es obligatoria';
    if (movimientos.length === 0) return 'Agrega al menos un movimiento';

    for (let i = 0; i < movimientos.length; i++) {
      const m = movimientos[i];
      if (!m) continue;
      if (!m.cuenta) return `El renglón ${i + 1} requiere una cuenta`;
      const cargo = Number(m.cargo) || 0;
      const abono = Number(m.abono) || 0;
      if (cargo > 0 && abono > 0) return `El renglón ${i + 1} no puede tener cargo y abono al mismo tiempo`;
      if (cargo === 0 && abono === 0) return `El renglón ${i + 1} debe tener cargo o abono`;
    }

    if (estatusDestino === 'aplicada') {
      if (movimientos.length < 2) return 'Una póliza aplicada requiere al menos dos movimientos';
      if (!cuadrada) return 'La póliza no cuadra; no se puede aplicar';
    }
    return null;
  }

  const handleGuardar = async (estatusDestino: 'borrador' | 'aplicada') => {
    const errorValidacion = validarAntesDeGuardar(estatusDestino);
    if (errorValidacion) {
      setFormError(errorValidacion);
      return;
    }

    const payload: PolizaEncabezadoInput = {
      tipo_poliza_id: Number(form.tipo_poliza_id),
      fecha: form.fecha,
      referencia: form.referencia.trim() || null,
      observaciones: form.observaciones.trim() || null,
      estatus: estatusDestino,
      movimientos: movimientos.map((m) => ({
        cuenta_id: m.cuenta!.id,
        concepto_id: m.concepto?.id ?? null,
        cargo: Number(m.cargo) || 0,
        abono: Number(m.abono) || 0,
        uuid_cfdi: m.uuid_cfdi.trim() || null,
        rfc: m.rfc.trim() || null,
      })),
    };

    try {
      setSaving(true);
      setFormError(null);
      if (isEdit && polizaId) {
        await actualizarPoliza(polizaId, payload);
      } else {
        await crearPoliza(payload);
      }
      onSaved();
    } catch (err: any) {
      setFormError(err?.message || 'No se pudo guardar la póliza');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ px: { xs: 1, md: 1.5 }, py: 1, pb: '56px' }}>
      <Typography sx={tituloVistaSx}>
        {isEdit ? 'Editar póliza' : 'Nueva póliza'}
      </Typography>

      <Paper variant="outlined" sx={panelSx}>
        {/* Banda de encabezado: una sola tira de captura, no una card. */}
        <Box sx={bandaCapturaSx}>
          <Stack direction="row" spacing={2} sx={{ mb: 0.5 }}>
            <CampoBanda label="Tipo de póliza" width={150}>
              <Select
                variant="standard"
                disableUnderline
                fullWidth
                disabled={isEdit || loadingInicial}
                value={form.tipo_poliza_id}
                onChange={(e) => handleChangeForm('tipo_poliza_id', String(e.target.value))}
                sx={bandaInputSx}
              >
                {tiposPoliza.map((t) => (
                  <MenuItem key={t.id} value={t.id} sx={{ fontSize: 13 }}>
                    {t.identificador}
                  </MenuItem>
                ))}
              </Select>
            </CampoBanda>

            <CampoBanda label="Número" width={80}>
              <Tooltip
                title={
                  numeroInfo
                    ? `Ejercicio ${numeroInfo.ejercicio} · Periodo ${numeroInfo.periodo}`
                    : 'Selecciona tipo de póliza y fecha'
                }
              >
                <TextField
                  variant="standard"
                  fullWidth
                  disabled
                  value={numeroInfo ? String(numeroInfo.numero) : ''}
                  InputProps={{ disableUnderline: true }}
                  sx={bandaInputSx}
                />
              </Tooltip>
            </CampoBanda>

            <CampoBanda label="Fecha" width={120}>
              <TextField
                variant="standard"
                type="date"
                fullWidth
                required
                value={form.fecha}
                onChange={(e) => handleChangeForm('fecha', e.target.value)}
                InputProps={{ disableUnderline: true }}
                sx={bandaInputSx}
              />
            </CampoBanda>

            <CampoBanda label="Estatus" width={100}>
              <Select
                variant="standard"
                disableUnderline
                fullWidth
                value={form.estatus}
                onChange={(e) => handleChangeForm('estatus', e.target.value)}
                sx={(theme) => ({
                  ...bandaInputSx,
                  '& .MuiSelect-select': {
                    ...bandaInputSx['& .MuiSelect-select'],
                    fontWeight: 650,
                    borderRadius: 0.5,
                    bgcolor: form.estatus === 'aplicada'
                      ? theme.emphasys.metric.applied.background
                      : theme.emphasys.metric.amount.background,
                    color: form.estatus === 'aplicada'
                      ? theme.emphasys.metric.applied.foreground
                      : theme.emphasys.metric.amount.foreground,
                  },
                })}
              >
                <MenuItem value="borrador" sx={{ fontSize: 13 }}>Borrador</MenuItem>
                <MenuItem value="aplicada" sx={{ fontSize: 13 }}>Aplicada</MenuItem>
              </Select>
            </CampoBanda>

            <CampoBanda label="Referencia">
              <TextField
                variant="standard"
                fullWidth
                value={form.referencia}
                onChange={(e) => handleChangeForm('referencia', e.target.value)}
                inputProps={{ maxLength: 100 }}
                InputProps={{ disableUnderline: true }}
                sx={bandaInputSx}
              />
            </CampoBanda>
          </Stack>

          <Stack direction="row">
            <CampoBanda label="Observaciones">
              <TextField
                variant="standard"
                fullWidth
                value={form.observaciones}
                onChange={(e) => handleChangeForm('observaciones', e.target.value)}
                InputProps={{ disableUnderline: true }}
                sx={bandaInputSx}
              />
            </CampoBanda>
          </Stack>
        </Box>

        {/* Toolbar compacta de movimientos */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 1,
            py: 0.375,
            borderBottom: (theme) => `1px solid ${theme.emphasys.content.border}`,
          }}
        >
          <Typography sx={seccionLabelSx}>
            Movimientos
          </Typography>
          <Stack direction="row" spacing={0.5}>
            <Button
              size="small"
              startIcon={<AddIcon sx={{ fontSize: 14 }} />}
              onClick={handleAgregarMovimiento}
              sx={botonSecundarioSx}
            >
              Agregar
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={handleCuadrar}
              sx={botonSecundarioSx}
            >
              Cuadrar
            </Button>
          </Stack>
        </Box>

        <TableContainer sx={{ maxHeight: 'calc(100vh - 320px)', overflowX: 'auto' }}>
          <Table size="small" stickyHeader sx={[compactTableSx, { minWidth: 950 }]}>
            <TableHead>
              <TableRow sx={encabezadoTablaSx}>
                <TableCell width={28}>#</TableCell>
                <TableCell width={220}>Cuenta</TableCell>
                <TableCell width={320}>Concepto</TableCell>
                <TableCell width={100} align="right">Cargo</TableCell>
                <TableCell width={100} align="right">Abono</TableCell>
                <TableCell width={125}>UUID CFDI</TableCell>
                <TableCell width={70}>RFC</TableCell>
                <TableCell width={32} align="center" />
              </TableRow>
            </TableHead>
            <TableBody>
              {movimientos.map((mov, index) => (
                <TableRow key={mov.id} hover selected={mov.id === filaActivaId}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    <Autocomplete
                      size="small"
                      options={cuentasAfectables}
                      value={mov.cuenta}
                      getOptionLabel={(o) => `${o.cuenta} — ${o.descripcion}`}
                      isOptionEqualToValue={(o, v) => o.id === v.id}
                      onChange={(_e, value) => actualizarMovimiento(mov.id, { cuenta: value })}
                      sx={celdaAutocompleteSx}
                      renderInput={(params) => (
                        <TextField
                          {...(params as any)}
                          variant="standard"
                          placeholder="Cuenta"
                          onFocus={() => setFilaActivaId(mov.id)}
                          InputProps={{ ...params.InputProps, disableUnderline: true }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Autocomplete
                      size="small"
                      options={conceptos}
                      value={mov.concepto}
                      getOptionLabel={(o) => o.nombre_concepto}
                      isOptionEqualToValue={(o, v) => o.id === v.id}
                      onChange={(_e, value) => actualizarMovimiento(mov.id, { concepto: value })}
                      sx={celdaAutocompleteSx}
                      renderInput={(params) => (
                        <TextField
                          {...(params as any)}
                          variant="standard"
                          placeholder="Concepto"
                          onFocus={() => setFilaActivaId(mov.id)}
                          InputProps={{ ...params.InputProps, disableUnderline: true }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      variant="standard"
                      fullWidth
                      value={formatImporteCelda(mov.cargo, campoImporteEnfocado === `${mov.id}-cargo`)}
                      onFocus={() => {
                        setFilaActivaId(mov.id);
                        setCampoImporteEnfocado(`${mov.id}-cargo`);
                      }}
                      onBlur={() =>
                        setCampoImporteEnfocado((prev) => (prev === `${mov.id}-cargo` ? null : prev))
                      }
                      onChange={(e) => actualizarMovimiento(mov.id, { cargo: e.target.value.replace(/[^0-9.]/g, '') })}
                      inputProps={{ style: { textAlign: 'right', fontWeight: 650, fontVariantNumeric: 'tabular-nums' } }}
                      InputProps={{ disableUnderline: true }}
                      sx={[celdaInputSx, (theme) => ({ '& .MuiInputBase-input': { color: theme.emphasys.content.foreground } })]}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      variant="standard"
                      fullWidth
                      value={formatImporteCelda(mov.abono, campoImporteEnfocado === `${mov.id}-abono`)}
                      onFocus={() => {
                        setFilaActivaId(mov.id);
                        setCampoImporteEnfocado(`${mov.id}-abono`);
                      }}
                      onBlur={() =>
                        setCampoImporteEnfocado((prev) => (prev === `${mov.id}-abono` ? null : prev))
                      }
                      onChange={(e) => actualizarMovimiento(mov.id, { abono: e.target.value.replace(/[^0-9.]/g, '') })}
                      inputProps={{ style: { textAlign: 'right', fontWeight: 650, fontVariantNumeric: 'tabular-nums' } }}
                      InputProps={{ disableUnderline: true }}
                      sx={[celdaInputSx, (theme) => ({ '& .MuiInputBase-input': { color: theme.emphasys.metric.applied.foreground } })]}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      variant="standard"
                      fullWidth
                      value={mov.uuid_cfdi}
                      onFocus={() => setFilaActivaId(mov.id)}
                      onChange={(e) => actualizarMovimiento(mov.id, { uuid_cfdi: e.target.value })}
                      inputProps={{ maxLength: 36 }}
                      InputProps={{ disableUnderline: true }}
                      sx={celdaInputSx}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      variant="standard"
                      fullWidth
                      value={mov.rfc}
                      onFocus={() => setFilaActivaId(mov.id)}
                      onChange={(e) => actualizarMovimiento(mov.id, { rfc: e.target.value.toUpperCase() })}
                      inputProps={{ maxLength: 13 }}
                      InputProps={{ disableUnderline: true }}
                      sx={celdaInputSx}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Eliminar renglón">
                      <IconButton size="small" onClick={() => handleEliminarMovimiento(mov.id)} sx={[iconoPeligroSx, { p: 0.25 }]}>
                        <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {movimientos.length === 0 && (
                <TableRow sx={{ height: 32 }}>
                  <TableCell colSpan={8} align="center" sx={{ color: 'text.secondary', fontSize: 12 }}>
                    Sin movimientos. Agrega el primer movimiento.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter>
              {/* Renglón resumen alineado por columnas: Cargo y Abono quedan
                  exactamente bajo su columna; el estado de cuadre ocupa el
                  ancho combinado de UUID CFDI + RFC + Acciones. */}
              <TableRow sx={filaTotalesTablaSx}>
                <TableCell />
                <TableCell />
                <TableCell>Totales</TableCell>
                <TableCell align="right">
                  {formatMoneda(totalCargos)}
                </TableCell>
                <TableCell align="right">
                  {formatMoneda(totalAbonos)}
                </TableCell>
                <TableCell colSpan={3} align="right">
                  <Typography
                    component="span"
                    sx={(theme) => ({
                      fontSize: 13,
                      fontWeight: 700,
                      color: cuadrada ? theme.emphasys.metric.applied.foreground : theme.emphasys.action.destructive,
                    })}
                  >
                    {cuadrada
                      ? 'Póliza cuadrada'
                      : diferencia > 0
                        ? `Por abonar: ${formatMoneda(diferencia)}`
                        : `Por cargar: ${formatMoneda(-diferencia)}`}
                  </Typography>
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>

        {formError && (
          <Alert severity="error" sx={{ fontSize: 12, py: 0, borderRadius: 0 }} onClose={() => setFormError(null)}>
            {formError}
          </Alert>
        )}
      </Paper>

      <Paper
        elevation={6}
          sx={(theme) => ({
          position: 'fixed',
          right: 24,
          bottom: 16,
          zIndex: theme.zIndex.fab,
          display: 'flex',
          gap: 0.5,
          p: 0.5,
          borderRadius: 1,
          backgroundColor: theme.emphasys.content.elevated,
          border: `1px solid ${theme.emphasys.content.border}`,
          boxShadow: 'none',
        })}
      >
        <Button
          size="small"
          variant="text"
          onClick={onCancel}
          disabled={saving}
          sx={botonSecundarioSx}
        >
          Volver
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={() => handleGuardar('borrador')}
          disabled={saving}
          sx={botonSecundarioSx}
        >
          {saving && form.estatus === 'borrador' ? 'Guardando...' : 'Guardar borrador'}
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={() => handleGuardar('aplicada')}
          disabled={saving || !cuadrada || movimientos.length < 2}
          sx={botonPrimarioSx}
        >
          {saving && form.estatus === 'aplicada' ? 'Guardando...' : 'Aplicar'}
        </Button>
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
