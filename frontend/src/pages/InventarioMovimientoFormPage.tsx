import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Alert,
  Divider,
  IconButton,
  MenuItem,
  Autocomplete,
  createFilterOptions,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';
import { fetchProductos } from '../services/productosService';
import { fetchAlmacenes, crearMovimientoManual } from '../services/inventarioService';
import type { Producto } from '../types/producto';
import type { Almacen, CrearMovimientoManualPayload, MovimientoPartidaPayload } from '../types/inventario';

type TipoMovimiento = 'entrada' | 'salida' | 'transferencia';

type Partida = {
  id: string;
  productoId: string;
  almacenOrigenId: string;
  almacenDestinoId: string;
  cantidad: string;
};

const tipoMovimientoOptions: TipoMovimiento[] = ['entrada', 'salida', 'transferencia'];

export default function InventarioMovimientoFormPage() {
  const navigate = useNavigate();

  const [tipoMovimiento, setTipoMovimiento] = useState<TipoMovimiento>('entrada');
  const [fecha, setFecha] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [observaciones, setObservaciones] = useState<string>('');
  const [partidas, setPartidas] = useState<Partida[]>([crearPartidaVacia()]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [loadingProductos, setLoadingProductos] = useState(false);
  const [loadingAlmacenes, setLoadingAlmacenes] = useState(false);
  const [errorProductos, setErrorProductos] = useState<string | null>(null);
  const [errorAlmacenes, setErrorAlmacenes] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const productosInventariables = useMemo(
    () => productos.filter((p) => (p.tipo_producto || '').toLowerCase() === 'inventariable'),
    [productos]
  );

  const filterProductos = useMemo(
    () =>
      createFilterOptions<Producto>({
        stringify: (option) => `${option.clave} ${option.descripcion}`.toLowerCase(),
      }),
    []
  );

  useEffect(() => {
    void cargarCatalogos();
  }, []);

  const cargarCatalogos = async () => {
    setLoadingProductos(true);
    setLoadingAlmacenes(true);
    setErrorProductos(null);
    setErrorAlmacenes(null);

    try {
      const data = await fetchProductos();
      setProductos(data);
    } catch (err) {
      setErrorProductos(err instanceof Error ? err.message : 'No se pudieron cargar los productos');
      setProductos([]);
    } finally {
      setLoadingProductos(false);
    }

    try {
      const data = await fetchAlmacenes();
      setAlmacenes(data);
    } catch (err) {
      setErrorAlmacenes(err instanceof Error ? err.message : 'No se pudieron cargar los almacenes');
      setAlmacenes([]);
    } finally {
      setLoadingAlmacenes(false);
    }
  };

  const showOrigen = tipoMovimiento !== 'entrada';
  const showDestino = tipoMovimiento !== 'salida';

  const handleAgregarPartida = () => {
    setPartidas((prev) => [...prev, crearPartidaVacia()]);
  };

  const handleEliminarPartida = (id: string) => {
    setPartidas((prev) => (prev.length > 1 ? prev.filter((p) => p.id !== id) : prev));
  };

  const handlePartidaChange = (id: string, field: keyof Partida, value: string) => {
    setPartidas((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const rowsConsecutivas = useMemo(
    () => partidas.map((p, idx) => ({ ...p, numero: idx + 1 })),
    [partidas]
  );

  const handleGuardar = () => {
    setFormError(null);

    if (!tipoMovimiento) {
      setFormError('El tipo de movimiento es obligatorio.');
      return;
    }

    if (!partidas.length) {
      setFormError('Agrega al menos una partida.');
      return;
    }

    for (const p of partidas) {
      if (!p.productoId) {
        setFormError('Todas las partidas deben tener un producto.');
        return;
      }

      if (!p.cantidad || Number(p.cantidad) <= 0) {
        setFormError('Cada partida debe tener una cantidad mayor a cero.');
        return;
      }

      if (showOrigen && !p.almacenOrigenId) {
        setFormError('El almacén de origen es obligatorio para este tipo de movimiento.');
        return;
      }

      if (showDestino && !p.almacenDestinoId) {
        setFormError('El almacén de destino es obligatorio para este tipo de movimiento.');
        return;
      }
    }

    const toNumberOrNull = (value: string) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    };

    const payload: CrearMovimientoManualPayload = {
      tipo_movimiento: tipoMovimiento,
      fecha,
      observaciones: observaciones || null,
      partidas: partidas.map<MovimientoPartidaPayload>((p) => {
        const origen = toNumberOrNull(p.almacenOrigenId);
        const destino = toNumberOrNull(p.almacenDestinoId);

        let almacen_id: number | null = null;
        let almacen_destino_id: number | null = null;

        if (tipoMovimiento === 'entrada') {
          almacen_id = destino;
          almacen_destino_id = null;
        } else if (tipoMovimiento === 'salida') {
          almacen_id = origen;
          almacen_destino_id = null;
        } else {
          // transferencia
          almacen_id = origen;
          almacen_destino_id = destino;
        }

        return {
          producto_id: Number(p.productoId),
          almacen_id: almacen_id as number,
          almacen_destino_id: tipoMovimiento === 'transferencia' ? almacen_destino_id : null,
          cantidad: Number(p.cantidad),
        };
      }),
    };

    setSaving(true);
    crearMovimientoManual(payload)
      .then(() => {
        alert('Movimiento guardado correctamente');
        navigate('/inventario/movimientos');
      })
      .catch((err) => {
        const msg = err?.message || 'No se pudo guardar el movimiento';
        setFormError(msg);
      })
      .finally(() => setSaving(false));
  };

  const handleCancelar = () => {
    navigate('/inventario/movimientos');
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1d2f68">
            Nuevo movimiento de inventario
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Captura el encabezado y las partidas del movimiento.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={handleCancelar}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleGuardar} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </Stack>
      </Stack>

      <Card variant="outlined">
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            Encabezado
          </Typography>
          <Divider />
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              select
              fullWidth
              label="Tipo de movimiento"
              value={tipoMovimiento}
              onChange={(e) => setTipoMovimiento(e.target.value as TipoMovimiento)}
            >
              {tipoMovimientoOptions.map((opt) => (
                <MenuItem key={opt} value={opt} sx={{ textTransform: 'capitalize' }}>
                  {opt}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              label="Fecha"
              type="datetime-local"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
          <TextField
            label="Observaciones"
            multiline
            minRows={3}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Notas u observaciones"
          />
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
            <Typography variant="subtitle1" fontWeight={700}>
              Partidas
            </Typography>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAgregarPartida}>
              Agregar partida
            </Button>
          </Stack>
          <Divider />

          {formError && <Alert severity="error">{formError}</Alert>}

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell width={60}>#</TableCell>
                  <TableCell>Producto</TableCell>
                  {showOrigen && <TableCell>Almacén origen</TableCell>}
                  {showDestino && <TableCell>Almacén destino</TableCell>}
                  <TableCell width={140} align="right">
                    Cantidad
                  </TableCell>
                  <TableCell width={80} align="center">
                    Acciones
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rowsConsecutivas.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell>{p.numero}</TableCell>
                    <TableCell>
                      <Autocomplete
                        size="small"
                        options={productosInventariables}
                        value={productosInventariables.find((opt) => String(opt.id) === p.productoId) ?? null}
                        onChange={(_e, option) => handlePartidaChange(p.id, 'productoId', option ? String(option.id) : '')}
                        getOptionLabel={(option) => `${option.clave} | ${option.descripcion}`}
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        filterOptions={filterProductos}
                        loading={loadingProductos}
                        noOptionsText={errorProductos ?? 'Sin resultados'}
                        loadingText="Cargando productos…"
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Producto"
                            placeholder="Buscar por clave o descripción"
                            disabled={loadingProductos}
                          />
                        )}
                      />
                    </TableCell>
                    {showOrigen && (
                      <TableCell>
                        <TextField
                          select
                          fullWidth
                          size="small"
                          value={p.almacenOrigenId}
                          onChange={(e) => handlePartidaChange(p.id, 'almacenOrigenId', e.target.value)}
                          label="Almacén origen"
                          required
                          disabled={loadingAlmacenes}
                        >
                          {loadingAlmacenes && <MenuItem disabled value="">Cargando almacenes…</MenuItem>}
                          {errorAlmacenes && <MenuItem disabled value="">{errorAlmacenes}</MenuItem>}
                          {!loadingAlmacenes && !errorAlmacenes && almacenes.length === 0 && (
                            <MenuItem disabled value="">Sin almacenes</MenuItem>
                          )}
                          {almacenes.map((alm) => (
                            <MenuItem key={alm.id} value={String(alm.id)}>
                              {alm.nombre}
                            </MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                    )}
                    {showDestino && (
                      <TableCell>
                        <TextField
                          select
                          fullWidth
                          size="small"
                          value={p.almacenDestinoId}
                          onChange={(e) => handlePartidaChange(p.id, 'almacenDestinoId', e.target.value)}
                          label="Almacén destino"
                          required
                          disabled={loadingAlmacenes}
                        >
                          <MenuItem value="">—</MenuItem>
                          {loadingAlmacenes && <MenuItem disabled value="">Cargando almacenes…</MenuItem>}
                          {errorAlmacenes && <MenuItem disabled value="">{errorAlmacenes}</MenuItem>}
                          {!loadingAlmacenes && !errorAlmacenes && almacenes.length === 0 && (
                            <MenuItem disabled value="">Sin almacenes</MenuItem>
                          )}
                          {almacenes.map((alm) => (
                            <MenuItem key={alm.id} value={String(alm.id)}>
                              {alm.nombre}
                            </MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                    )}
                    <TableCell align="right">
                      <TextField
                        type="number"
                        fullWidth
                        size="small"
                        value={p.cantidad}
                        onChange={(e) => handlePartidaChange(p.id, 'cantidad', e.target.value)}
                        inputProps={{ min: 0, step: '0.01', style: { textAlign: 'right' } }}
                        label="Cantidad"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Eliminar">
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleEliminarPartida(p.id)}
                            disabled={partidas.length === 1}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}

function crearPartidaVacia(): Partida {
  return {
    id: crypto.randomUUID(),
    productoId: '',
    almacenOrigenId: '',
    almacenDestinoId: '',
    cantidad: '',
  };
}
