import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  fetchCfdiSatBitacora,
  type CfdiSatBitacoraAccion,
  type CfdiSatBitacoraEntrada,
  type CfdiSatBitacoraFiltros,
} from '../../services/cfdiSatService';

function formatFecha(raw?: string | null): string {
  if (!raw) return '—';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString('es-MX');
}

const ACCIONES: Array<{ value: CfdiSatBitacoraAccion; label: string }> = [
  { value: 'credencial_subida', label: 'Credencial subida' },
  { value: 'credencial_eliminada', label: 'Credencial eliminada' },
  { value: 'autorizacion_aceptada', label: 'Autorización aceptada' },
  { value: 'solicitud_creada', label: 'Solicitud creada' },
  { value: 'verificacion', label: 'Verificación' },
  { value: 'descarga_paquete', label: 'Descarga de paquete' },
  { value: 'importado_compras', label: 'Importado a compras' },
  { value: 'verificacion_automatica', label: 'Verificación automática' },
  { value: 'descarga_automatica', label: 'Descarga automática' },
  { value: 'automatizacion_error', label: 'Error de automatización' },
  { value: 'vinculacion_documento', label: 'Vinculación a factura existente' },
  { value: 'error', label: 'Error' },
];

const FILTROS_VACIOS: CfdiSatBitacoraFiltros = {
  fecha_inicio: '',
  fecha_fin: '',
  accion: '',
  resultado: '',
  uuid: '',
};

export default function BitacoraSatSection() {
  const [filtrosForm, setFiltrosForm] = React.useState<CfdiSatBitacoraFiltros>(FILTROS_VACIOS);
  const [filtrosAplicados, setFiltrosAplicados] = React.useState<CfdiSatBitacoraFiltros>(FILTROS_VACIOS);
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(25);

  const [entradas, setEntradas] = React.useState<CfdiSatBitacoraEntrada[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const cargar = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resultado = await fetchCfdiSatBitacora({
        ...filtrosAplicados,
        page: page + 1,
        pageSize,
      });
      setEntradas(resultado.bitacora);
      setTotal(resultado.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la bitácora');
    } finally {
      setLoading(false);
    }
  }, [filtrosAplicados, page, pageSize]);

  React.useEffect(() => {
    void cargar();
  }, [cargar]);

  const handleFiltroChange = (campo: keyof CfdiSatBitacoraFiltros, valor: string) => {
    setFiltrosForm((prev) => ({ ...prev, [campo]: valor }));
  };

  const handleBuscar = () => {
    setPage(0);
    setFiltrosAplicados(filtrosForm);
  };

  const handleLimpiar = () => {
    setFiltrosForm(FILTROS_VACIOS);
    setFiltrosAplicados(FILTROS_VACIOS);
    setPage(0);
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: 2, borderColor: '#dbe3f0' }}>
      <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack spacing={0.5}>
          <Typography variant="h6" fontWeight={700} color="#1d2f68">
            Bitácora
          </Typography>
          <Typography variant="body2" color="#4b5563">
            Auditoría de todas las acciones del módulo. Nunca incluye contraseñas, contenido de certificados ni
            rutas físicas.
          </Typography>
        </Stack>

        {error && <Alert severity="error">{error}</Alert>}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
            gap: 1.5,
          }}
        >
          <TextField
            label="Fecha inicio"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={filtrosForm.fecha_inicio}
            onChange={(e) => handleFiltroChange('fecha_inicio', e.target.value)}
          />
          <TextField
            label="Fecha fin"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={filtrosForm.fecha_fin}
            onChange={(e) => handleFiltroChange('fecha_fin', e.target.value)}
          />
          <TextField
            select
            label="Acción"
            size="small"
            value={filtrosForm.accion}
            onChange={(e) => handleFiltroChange('accion', e.target.value)}
          >
            <MenuItem value="">Todas</MenuItem>
            {ACCIONES.map((accion) => (
              <MenuItem key={accion.value} value={accion.value}>
                {accion.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Resultado"
            size="small"
            value={filtrosForm.resultado}
            onChange={(e) => handleFiltroChange('resultado', e.target.value)}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="ok">OK</MenuItem>
            <MenuItem value="error">Error</MenuItem>
          </TextField>
          <TextField
            label="Solicitud ID"
            size="small"
            type="number"
            value={filtrosForm.solicitud_id ?? ''}
            onChange={(e) =>
              setFiltrosForm((prev) => {
                const next = { ...prev };
                if (e.target.value) {
                  next.solicitud_id = Number(e.target.value);
                } else {
                  delete next.solicitud_id;
                }
                return next;
              })
            }
          />
          <TextField
            label="Comprobante ID"
            size="small"
            type="number"
            value={filtrosForm.comprobante_id ?? ''}
            onChange={(e) =>
              setFiltrosForm((prev) => {
                const next = { ...prev };
                if (e.target.value) {
                  next.comprobante_id = Number(e.target.value);
                } else {
                  delete next.comprobante_id;
                }
                return next;
              })
            }
          />
          <TextField
            label="UUID"
            size="small"
            value={filtrosForm.uuid}
            onChange={(e) => handleFiltroChange('uuid', e.target.value)}
          />
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button variant="contained" onClick={handleBuscar} sx={{ textTransform: 'none', fontWeight: 700, backgroundColor: '#1d2f68' }}>
            Buscar
          </Button>
          <Button variant="outlined" onClick={handleLimpiar} sx={{ textTransform: 'none' }}>
            Limpiar filtros
          </Button>
        </Stack>

        {loading ? (
          <Stack alignItems="center" py={4}>
            <CircularProgress size={28} />
          </Stack>
        ) : entradas.length === 0 ? (
          <Alert severity="info">No hay entradas de bitácora que coincidan con los filtros.</Alert>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Usuario</TableCell>
                    <TableCell>Acción</TableCell>
                    <TableCell>Resultado</TableCell>
                    <TableCell>Detalle</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {entradas.map((entrada) => (
                    <TableRow key={entrada.id} hover>
                      <TableCell>{formatFecha(entrada.creado_en)}</TableCell>
                      <TableCell>{entrada.usuario_nombre ?? `#${entrada.usuario_id}`}</TableCell>
                      <TableCell>
                        {ACCIONES.find((a) => a.value === entrada.accion)?.label ?? entrada.accion}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={entrada.resultado.toUpperCase()}
                          size="small"
                          color={entrada.resultado === 'error' ? 'error' : 'success'}
                        />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 420 }}>
                        <Tooltip title={entrada.detalle ?? ''}>
                          <Typography variant="body2" noWrap>
                            {entrada.detalle ?? '—'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={total}
              page={page}
              onPageChange={(_event, newPage) => setPage(newPage)}
              rowsPerPage={pageSize}
              onRowsPerPageChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 25, 50, 100]}
              labelRowsPerPage="Filas por página"
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
