import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { DataGrid } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import type { GridColDef, GridRenderCellParams, GridRowSelectionModel } from '@mui/x-data-grid';
import {
  STANDARD_DATA_GRID_HEADER_HEIGHT,
  STANDARD_DATA_GRID_ROW_HEIGHT,
  standardDataGridSx,
} from '../../components/grids/standardDataGridSx';
import {
  fetchFacturasCompraPendientes,
  fetchMetodosPago,
  fetchCuentas,
  crearProgramacionesMasiva,
} from '../../services/finanzasService';
import { resolverFolioVisual } from '../../utils/documentos.utils';
import { apiFetch } from '../../api/apiClient';
import type {
  FacturaCompraPendiente,
  FinanzasCuenta,
  FinanzasMetodoPago,
  ProgramacionMasivaInput,
} from '../../types/finanzas';

type ContactoOpcion = { id: number; nombre: string; rfc?: string | null };

const sanitizeNumber = (v: string) => v.replace(/[^0-9.]/g, '');

const toCivilDate = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatFecha = (iso?: string | null): string => {
  if (!iso) return '—';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(iso).slice(0, 10);
  return `${m[3]}/${m[2]}/${m[1]}`;
};

const formatMonto = (v: number) =>
  v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const LIMITE_FACTURAS = 300;

interface ProgramacionMasivaDrawerProps {
  open: boolean;
  onClose: () => void;
  onSaved: (cantidadCreadas: number) => void;
}

export default function ProgramacionMasivaDrawer({ open, onClose, onSaved }: ProgramacionMasivaDrawerProps) {
  const hoy = toCivilDate();

  // ── Filtros ──────────────────────────────────────────────────────────────
  const [proveedor, setProveedor] = useState<ContactoOpcion | null>(null);
  const [opcionesProveedor, setOpcionesProveedor] = useState<ContactoOpcion[]>([]);
  const [buscandoProv, setBuscandoProv] = useState(false);
  const [search, setSearch] = useState('');
  const [moneda, setMoneda] = useState('');
  const [vencimiento, setVencimiento] = useState<'todas' | 'vencidas' | 'por_vencer'>('todas');

  // ── Facturas ─────────────────────────────────────────────────────────────
  const [facturas, setFacturas] = useState<FacturaCompraPendiente[]>([]);
  const [cargandoFacturas, setCargandoFacturas] = useState(false);
  const [seleccion, setSeleccion] = useState<GridRowSelectionModel>([]);
  const [montos, setMontos] = useState<Map<number, string>>(new Map());

  // ── Cabecera compartida ──────────────────────────────────────────────────
  const [cuentas, setCuentas] = useState<FinanzasCuenta[]>([]);
  const [metodosPago, setMetodosPago] = useState<FinanzasMetodoPago[]>([]);
  const [fechaProgramada, setFechaProgramada] = useState(hoy);
  const [cuentaOrigenId, setCuentaOrigenId] = useState<number | ''>('');
  const [metodoPagoId, setMetodoPagoId] = useState<number | ''>('');
  const [referencia, setReferencia] = useState('');
  const [notas, setNotas] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metodoSeleccionado = metodosPago.find((m) => m.id === Number(metodoPagoId)) ?? null;
  const referenciaObligatoria = metodoSeleccionado?.requiere_referencia === true;

  // ── Reset al abrir ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setError(null);
    setProveedor(null);
    setSearch('');
    setMoneda('');
    setVencimiento('todas');
    setSeleccion([]);
    setMontos(new Map());
    setFechaProgramada(hoy);
    setCuentaOrigenId('');
    setMetodoPagoId('');
    setReferencia('');
    setNotas('');
    fetchCuentas()
      .then((data) => setCuentas(data.filter((c) => !c.cuenta_cerrada)))
      .catch(() => setCuentas([]));
    fetchMetodosPago(true)
      .then(setMetodosPago)
      .catch(() => setMetodosPago([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Cargar facturas según filtros ───────────────────────────────────────
  const cargarFacturas = useCallback(async () => {
    setCargandoFacturas(true);
    try {
      const data = await fetchFacturasCompraPendientes({
        proveedorId: proveedor?.id ?? null,
        search: search.trim() || null,
        moneda: moneda || null,
        vencimiento: vencimiento === 'todas' ? null : vencimiento,
        limit: LIMITE_FACTURAS,
      });
      setFacturas(data);
    } finally {
      setCargandoFacturas(false);
    }
  }, [proveedor, search, moneda, vencimiento]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => { void cargarFacturas(); }, 300);
    return () => clearTimeout(t);
  }, [open, cargarFacturas]);

  // ── Búsqueda de proveedores ──────────────────────────────────────────────
  const buscarProveedores = useCallback((input: string) => {
    setBuscandoProv(true);
    const qs = new URLSearchParams({ limit: '40', tipos: 'proveedor,varios' });
    if (input.trim()) qs.set('search', input.trim());
    apiFetch(`/api/contactos?${qs.toString()}`)
      .then(async (res) => {
        if (!res.ok) { setOpcionesProveedor([]); return; }
        const raw = (await res.json()) as ContactoOpcion[] | { data?: ContactoOpcion[]; items?: ContactoOpcion[] };
        const items: ContactoOpcion[] = Array.isArray(raw)
          ? raw
          : (raw as any).data ?? (raw as any).items ?? [];
        setOpcionesProveedor(items);
      })
      .catch(() => setOpcionesProveedor([]))
      .finally(() => setBuscandoProv(false));
  }, []);

  // ── Selección y montos ───────────────────────────────────────────────────
  const handleSelectionChange = (model: GridRowSelectionModel) => {
    setMontos((prev) => {
      const nuevo = new Map(prev);
      const idsSeleccionados = new Set(model.map((id) => Number(id)));
      // agregar default para nuevas selecciones
      for (const id of idsSeleccionados) {
        if (!nuevo.has(id)) {
          const f = facturas.find((x) => x.id === id);
          if (f) nuevo.set(id, formatMonto(f.saldo_disponible_programar));
        }
      }
      // limpiar las que ya no están seleccionadas
      for (const id of Array.from(nuevo.keys())) {
        if (!idsSeleccionados.has(id)) nuevo.delete(id);
      }
      return nuevo;
    });
    setSeleccion(model);
  };

  const actualizarMonto = (documentoId: number, valor: string) => {
    setMontos((prev) => {
      const nuevo = new Map(prev);
      nuevo.set(documentoId, sanitizeNumber(valor));
      return nuevo;
    });
  };

  const formatearMontoCampo = (documentoId: number) => {
    setMontos((prev) => {
      const nuevo = new Map(prev);
      const raw = sanitizeNumber(prev.get(documentoId) ?? '');
      const n = parseFloat(raw);
      if (!isNaN(n) && n > 0) nuevo.set(documentoId, formatMonto(n));
      return nuevo;
    });
  };

  // ── Resumen agrupado por proveedor + moneda ─────────────────────────────
  type GrupoResumen = { proveedorId: number; proveedorNombre: string; moneda: string; total: number; cantidad: number };
  const resumen = useMemo<GrupoResumen[]>(() => {
    const map = new Map<string, GrupoResumen>();
    for (const id of seleccion) {
      const f = facturas.find((x) => x.id === Number(id));
      if (!f) continue;
      const montoStr = montos.get(Number(id)) ?? '0';
      const monto = parseFloat(sanitizeNumber(montoStr)) || 0;
      const key = `${f.proveedor_id}_${f.moneda}`;
      if (!map.has(key)) {
        map.set(key, { proveedorId: f.proveedor_id, proveedorNombre: f.proveedor_nombre, moneda: f.moneda, total: 0, cantidad: 0 });
      }
      const g = map.get(key)!;
      g.total += monto;
      g.cantidad += 1;
    }
    return Array.from(map.values()).sort((a, b) => a.proveedorNombre.localeCompare(b.proveedorNombre));
  }, [seleccion, montos, facturas]);

  // ── Guardar ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setError(null);

    if (seleccion.length === 0) {
      setError('Selecciona al menos una factura.');
      return;
    }
    if (!fechaProgramada) {
      setError('La fecha programada es requerida.');
      return;
    }
    if (referenciaObligatoria && !referencia.trim()) {
      setError(`El método "${metodoSeleccionado?.nombre}" requiere una referencia.`);
      return;
    }

    const facturasPayload: Array<{ documento_id: number; monto_programado: number }> = [];
    for (const id of seleccion) {
      const docId = Number(id);
      const montoStr = montos.get(docId) ?? '';
      const monto = parseFloat(sanitizeNumber(montoStr));
      if (!monto || monto <= 0) {
        const f = facturas.find((x) => x.id === docId);
        setError(`El monto de la factura ${f ? resolverFolioVisual(f, 'factura_compra') : docId} debe ser mayor a 0.`);
        return;
      }
      const f = facturas.find((x) => x.id === docId);
      if (f && monto > f.saldo_disponible_programar + 0.001) {
        setError(`El monto para ${resolverFolioVisual(f, 'factura_compra')} excede el saldo disponible (${formatMonto(f.saldo_disponible_programar)}).`);
        return;
      }
      facturasPayload.push({ documento_id: docId, monto_programado: monto });
    }

    const payload: ProgramacionMasivaInput = {
      fecha_programada: fechaProgramada,
      cuenta_origen_id: cuentaOrigenId ? Number(cuentaOrigenId) : null,
      metodo_pago_id: metodoPagoId ? Number(metodoPagoId) : null,
      referencia: referencia.trim() || null,
      notas: notas.trim() || null,
      facturas: facturasPayload,
    };

    try {
      setSaving(true);
      const creadas = await crearProgramacionesMasiva(payload);
      onSaved(creadas.length);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'No se pudieron crear las programaciones');
    } finally {
      setSaving(false);
    }
  };

  const columns: GridColDef<FacturaCompraPendiente>[] = useMemo(() => [
    {
      field: 'proveedor_nombre',
      headerName: 'Proveedor',
      flex: 1,
      minWidth: 160,
    },
    {
      field: 'folio',
      headerName: 'Folio',
      width: 110,
      renderCell: (p: GridRenderCellParams<FacturaCompraPendiente>) => resolverFolioVisual(p.row, 'factura_compra'),
    },
    {
      field: 'fecha_documento',
      headerName: 'Fecha',
      width: 95,
      renderCell: (p: GridRenderCellParams<FacturaCompraPendiente, string>) => formatFecha(p.value),
    },
    {
      field: 'fecha_vencimiento',
      headerName: 'Vence',
      width: 95,
      renderCell: (p: GridRenderCellParams<FacturaCompraPendiente, string>) => {
        if (!p.value) return <Typography sx={{ fontSize: 13 }} color="text.disabled">—</Typography>;
        const vencida = p.value < hoy;
        return (
          <Typography sx={{ fontSize: 13 }} color={vencida ? 'error.main' : 'text.secondary'}>
            {formatFecha(p.value)}
          </Typography>
        );
      },
    },
    { field: 'moneda', headerName: 'Moneda', width: 75 },
    {
      field: 'saldo_disponible_programar',
      headerName: 'Saldo disponible',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<FacturaCompraPendiente, number>) => (
        <Typography sx={{ fontSize: 13 }}>{formatMonto(p.value ?? 0)}</Typography>
      ),
    },
    {
      field: '__monto',
      headerName: 'Monto a programar',
      width: 160,
      align: 'right',
      headerAlign: 'right',
      sortable: false,
      renderCell: (p: GridRenderCellParams<FacturaCompraPendiente>) => {
        const checked = seleccion.some((id) => Number(id) === p.row.id);
        if (!checked) {
          return <Typography sx={{ fontSize: 13 }} color="text.disabled">—</Typography>;
        }
        const valor = montos.get(p.row.id) ?? '';
        const montoNum = parseFloat(sanitizeNumber(valor)) || 0;
        const excede = montoNum > p.row.saldo_disponible_programar + 0.001;
        return (
          <TextField
            size="small"
            value={valor}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => actualizarMonto(p.row.id, e.target.value)}
            onBlur={() => formatearMontoCampo(p.row.id)}
            error={excede}
            inputProps={{ style: { textAlign: 'right', fontSize: 12, padding: '4px 8px' } }}
            sx={{ width: 140 }}
          />
        );
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [seleccion, montos, hoy]);

  const totalGeneral = resumen.reduce((acc, g) => acc + g.total, 0);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: { xs: '100%', md: '92%' },
          maxWidth: 1400,
        },
      }}
    >
      <Box sx={{ p: 3, height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6" fontWeight={700} color="#1d2f68">
              Programar facturas pendientes
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Selecciona facturas de uno o varios proveedores. Se creará una programación de pago por cada combinación de proveedor y moneda.
            </Typography>
          </Box>
          <IconButton onClick={onClose}><CloseIcon /></IconButton>
        </Stack>

        <Divider />

        {/* ── Filtros ──────────────────────────────────────────────────── */}
        <Box sx={{
          display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap',
          '& .MuiInputBase-input': { fontSize: 13 },
          '& .MuiInputLabel-root': { fontSize: 13 },
        }}>
          <Autocomplete<ContactoOpcion>
            options={opcionesProveedor}
            loading={buscandoProv}
            value={proveedor}
            onChange={(_, val) => setProveedor(val)}
            onInputChange={(_, input) => buscarProveedores(input)}
            onOpen={() => { if (!opcionesProveedor.length) buscarProveedores(''); }}
            getOptionLabel={(o) => o.nombre}
            getOptionKey={(o) => o.id}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            sx={{ width: 220 }}
            renderInput={(p) => <TextField {...(p as any)} label="Proveedor" size="small" placeholder="Todos" />}
          />
          <TextField
            label="Buscar folio"
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ width: 160 }}
          />
          <TextField
            label="Vencimiento"
            size="small"
            select
            value={vencimiento}
            onChange={(e) => setVencimiento(e.target.value as 'todas' | 'vencidas' | 'por_vencer')}
            sx={{ width: 140 }}
          >
            <MenuItem value="todas">Todas</MenuItem>
            <MenuItem value="vencidas">Vencidas</MenuItem>
            <MenuItem value="por_vencer">Por vencer</MenuItem>
          </TextField>
          <TextField
            label="Moneda"
            size="small"
            select
            value={moneda}
            onChange={(e) => setMoneda(e.target.value)}
            sx={{ width: 100 }}
          >
            <MenuItem value="">Todas</MenuItem>
            <MenuItem value="MXN">MXN</MenuItem>
            <MenuItem value="USD">USD</MenuItem>
            <MenuItem value="EUR">EUR</MenuItem>
          </TextField>
        </Box>

        {/* ── Grid de facturas ─────────────────────────────────────────── */}
        <Box sx={{ height: 380, position: 'relative' }}>
          {cargandoFacturas && (
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.6)', zIndex: 1 }}>
              <CircularProgress size={24} />
            </Box>
          )}
          <DataGrid
            rows={facturas}
            columns={columns}
            getRowId={(row) => (row as FacturaCompraPendiente).id}
            checkboxSelection
            disableRowSelectionOnClick
            rowSelectionModel={seleccion}
            onRowSelectionModelChange={handleSelectionChange}
            rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
            columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
            localeText={{
              ...esES.components.MuiDataGrid.defaultProps.localeText,
              noRowsLabel: 'No hay facturas pendientes con estos filtros',
            }}
            sx={[standardDataGridSx, { fontSize: 13, border: '1px solid', borderColor: 'divider' }]}
          />
        </Box>
        {facturas.length >= LIMITE_FACTURAS && (
          <Typography variant="caption" color="text.secondary">
            Se muestran las primeras {LIMITE_FACTURAS} facturas. Usa los filtros para acotar la búsqueda si no encuentras la que buscas.
          </Typography>
        )}

        {/* ── Resumen por proveedor + moneda ───────────────────────────── */}
        {resumen.length > 0 && (
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Se crearán {resumen.length} programación{resumen.length !== 1 ? 'es' : ''} de pago
            </Typography>
            <Stack spacing={0.5}>
              {resumen.map((g) => (
                <Box key={`${g.proveedorId}_${g.moneda}`} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ fontSize: 13 }}>
                    {g.proveedorNombre} ({g.cantidad} factura{g.cantidad !== 1 ? 's' : ''})
                  </Typography>
                  <Typography variant="body2" fontWeight={700} sx={{ fontSize: 13 }}>
                    {formatMonto(g.total)} {g.moneda}
                  </Typography>
                </Box>
              ))}
            </Stack>
            <Divider sx={{ my: 0.75 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" fontWeight={700}>Total seleccionado</Typography>
              <Typography variant="body2" fontWeight={700}>{formatMonto(totalGeneral)}</Typography>
            </Box>
          </Box>
        )}

        <Divider />

        {/* ── Cabecera compartida ──────────────────────────────────────── */}
        <Typography variant="subtitle2" fontWeight={700}>Datos del pago</Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <TextField
            label="Fecha programada"
            type="date"
            size="small"
            value={fechaProgramada}
            onChange={(e) => setFechaProgramada(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 200 }}
          />
          <FormControl size="small" sx={{ width: 220 }}>
            <InputLabel id="cuenta-origen-masiva-label">Cuenta de origen</InputLabel>
            <Select
              labelId="cuenta-origen-masiva-label"
              value={cuentaOrigenId}
              label="Cuenta de origen"
              onChange={(e) => setCuentaOrigenId(e.target.value as number | '')}
            >
              <MenuItem value=""><em>Sin especificar</em></MenuItem>
              {cuentas.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.identificador}{c.moneda !== 'MXN' ? ` (${c.moneda})` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ width: 220 }}>
            <InputLabel id="metodo-pago-masiva-label">Método de pago</InputLabel>
            <Select
              labelId="metodo-pago-masiva-label"
              value={metodoPagoId !== '' ? String(metodoPagoId) : ''}
              label="Método de pago"
              onChange={(e) => setMetodoPagoId(e.target.value ? Number(e.target.value) : '')}
            >
              <MenuItem value=""><em>Sin especificar</em></MenuItem>
              {metodosPago.map((m) => (
                <MenuItem key={m.id} value={String(m.id)}>{m.nombre}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <TextField
            label={referenciaObligatoria ? 'Referencia *' : 'Referencia'}
            size="small"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder={referenciaObligatoria ? 'Requerido para este método' : 'Número de cheque, SPEI, etc.'}
            sx={{ width: 260 }}
            error={referenciaObligatoria && !referencia.trim()}
            helperText={
              referenciaObligatoria && !referencia.trim()
                ? `El método "${metodoSeleccionado?.nombre ?? ''}" requiere una referencia`
                : undefined
            }
          />
          <TextField
            label="Notas"
            size="small"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Instrucciones o notas adicionales"
            sx={{ flexGrow: 1, minWidth: 260 }}
          />
        </Stack>

        {error && (
          <Typography color="error" variant="body2">{error}</Typography>
        )}

        <Box sx={{ flexGrow: 1 }} />

        <Stack direction="row" justifyContent="flex-end" spacing={1.5} sx={{ pt: 1 }}>
          <Button onClick={onClose} disabled={saving} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || seleccion.length === 0}
            variant="contained"
            sx={{ textTransform: 'none', borderRadius: 999, bgcolor: '#1d2f68', '&:hover': { bgcolor: '#162551' } }}
          >
            {saving
              ? 'Guardando...'
              : `Programar ${resumen.length} pago${resumen.length !== 1 ? 's' : ''}`}
          </Button>
        </Stack>
      </Box>
    </Drawer>
  );
}
