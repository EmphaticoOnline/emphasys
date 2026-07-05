import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  MenuItem,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  descargarXmlComprobante,
  fetchCfdiSatComprobantes,
  type CfdiSatComprobante,
  type CfdiSatComprobanteFiltros,
  type CfdiSatEstadoImportacionOperativo,
} from '../../services/cfdiSatService';
import ComprobanteDetalleDialog from './ComprobanteDetalleDialog';
import ImportarComprasDialog from './ImportarComprasDialog';
import ImportarLoteComprasDialog from './ImportarLoteComprasDialog';
import VincularDocumentoDialog from './VincularDocumentoDialog';
import { ESTADO_IMPORTACION_INFO, POSIBLE_DUPLICADO_LABEL } from './estadoImportacion';

function formatFecha(raw?: string | null): string {
  if (!raw) return '—';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('es-MX');
}

/** Fuente de verdad: la evaluación operativa del backend (Fase 10), no un heurístico duplicado en el cliente. */
function esElegibleParaImportar(comprobante: CfdiSatComprobante): boolean {
  return comprobante.evaluacion?.elegible_importacion ?? false;
}

/**
 * "Vincular" es independiente del estado operativo de importación (Fase 10):
 * incluso un comprobante bloqueado por proveedor faltante o impuestos sin
 * mapear puede resolverse vinculándolo a una factura ya capturada
 * manualmente, sin pasar por esas validaciones (Fase 11, Alcance 1).
 */
function puedeVincular(comprobante: CfdiSatComprobante): boolean {
  return (
    comprobante.tipo_descarga === 'recibidos' &&
    comprobante.tipo_comprobante === 'I' &&
    !comprobante.importado_compras &&
    comprobante.estatus_sat !== 'cancelado' &&
    Boolean(comprobante.uuid) &&
    Boolean(comprobante.evaluacion?.posible_documento_existente)
  );
}

type EstadoTab = 'todos' | 'listos' | 'proveedor' | 'impuestos' | 'cancelados' | 'importados' | 'duplicados';

const TABS: { value: EstadoTab; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'listos', label: 'Listos para importar' },
  { value: 'proveedor', label: 'Pendientes por proveedor' },
  { value: 'impuestos', label: 'Pendientes por impuestos' },
  { value: 'cancelados', label: 'Cancelados' },
  { value: 'importados', label: 'Ya importados' },
  { value: 'duplicados', label: 'Posibles duplicados' },
];

const ESTADOS_PROVEEDOR: CfdiSatEstadoImportacionOperativo[] = [
  'proveedor_no_encontrado',
  'proveedor_duplicado',
  'proveedor_tipo_invalido',
];
const ESTADOS_IMPORTADO: CfdiSatEstadoImportacionOperativo[] = ['importado', 'uuid_ya_existe_en_documentos'];

/**
 * "Posibles duplicados" es transversal (depende de posible_documento_existente,
 * no del estado principal), así que se evalúa aparte del resto de las pestañas.
 */
function comprobantePerteneceATab(comprobante: CfdiSatComprobante, tab: EstadoTab): boolean {
  if (tab === 'todos') return true;
  if (tab === 'duplicados') return Boolean(comprobante.evaluacion?.posible_documento_existente);

  const estado = comprobante.evaluacion?.estado_importacion_operativo;
  if (!estado) return false;

  switch (tab) {
    case 'listos':
      return estado === 'listo_para_importar';
    case 'proveedor':
      return ESTADOS_PROVEEDOR.includes(estado);
    case 'impuestos':
      return estado === 'impuestos_no_mapeados';
    case 'cancelados':
      return estado === 'cancelado';
    case 'importados':
      return ESTADOS_IMPORTADO.includes(estado);
    default:
      return true;
  }
}

const FILTROS_VACIOS: CfdiSatComprobanteFiltros = {
  tipo_descarga: '',
  uuid: '',
  rfc_emisor: '',
  rfc_receptor: '',
  nombre_emisor: '',
  nombre_receptor: '',
  fecha_inicio: '',
  fecha_fin: '',
  tipo_comprobante: '',
  estatus_sat: '',
  importado_compras: '',
};

export default function ComprobantesSatSection({
  puedeAdministrar,
  onCambio,
}: {
  puedeAdministrar: boolean;
  /** Se llama tras importar (individual o lote) o vincular, además del refresco local, para que
   *  la página contenedora refresque resumen/alertas/bitácora (esos datos pueden cambiar aquí). */
  onCambio?: () => void;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const uuidDesdeUrl = searchParams.get('uuid');

  const [filtrosForm, setFiltrosForm] = React.useState<CfdiSatComprobanteFiltros>(() =>
    uuidDesdeUrl ? { ...FILTROS_VACIOS, uuid: uuidDesdeUrl } : FILTROS_VACIOS
  );
  const [filtrosAplicados, setFiltrosAplicados] = React.useState<CfdiSatComprobanteFiltros>(() =>
    uuidDesdeUrl ? { ...FILTROS_VACIOS, uuid: uuidDesdeUrl } : FILTROS_VACIOS
  );
  const [page, setPage] = React.useState(0); // 0-based (convención de MUI TablePagination)
  const [pageSize, setPageSize] = React.useState(25);

  const [comprobantes, setComprobantes] = React.useState<CfdiSatComprobante[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [detalleId, setDetalleId] = React.useState<number | null>(null);
  const [descargandoXmlId, setDescargandoXmlId] = React.useState<number | null>(null);
  const [importarDialogId, setImportarDialogId] = React.useState<number | null>(null);
  const [seleccionados, setSeleccionados] = React.useState<Set<number>>(new Set());
  const [loteDialogIds, setLoteDialogIds] = React.useState<number[] | null>(null);
  const [estadoTab, setEstadoTab] = React.useState<EstadoTab>('todos');
  const [vincularComprobante, setVincularComprobante] = React.useState<CfdiSatComprobante | null>(null);

  const cargar = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resultado = await fetchCfdiSatComprobantes({
        ...filtrosAplicados,
        page: page + 1,
        pageSize,
        incluir_evaluacion: true,
      });
      setComprobantes(resultado.comprobantes);
      setTotal(resultado.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los comprobantes');
    } finally {
      setLoading(false);
    }
  }, [filtrosAplicados, page, pageSize]);

  React.useEffect(() => {
    void cargar();
  }, [cargar]);

  // La selección y la pestaña de estado operativo son solo de la página/filtro actual: si cambian, ya no aplican.
  React.useEffect(() => {
    setSeleccionados(new Set());
    setEstadoTab('todos');
  }, [filtrosAplicados, page, pageSize]);

  const handleFiltroChange = (campo: keyof CfdiSatComprobanteFiltros, valor: string) => {
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

  const handleDescargarXml = async (comprobante: CfdiSatComprobante) => {
    setDescargandoXmlId(comprobante.id);
    try {
      await descargarXmlComprobante(comprobante.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo descargar el XML');
    } finally {
      setDescargandoXmlId(null);
    }
  };

  const handleCrearProveedor = (comprobante: CfdiSatComprobante) => {
    const params = new URLSearchParams({ tipo_contacto: 'Proveedor' });
    if (comprobante.rfc_emisor) params.set('rfc', comprobante.rfc_emisor);
    if (comprobante.nombre_emisor) params.set('nombre', comprobante.nombre_emisor);
    navigate(`/contactos/nuevo?${params.toString()}`);
  };

  const conteosPorTab = React.useMemo(() => {
    const conteos: Record<EstadoTab, number> = {
      todos: comprobantes.length,
      listos: 0,
      proveedor: 0,
      impuestos: 0,
      cancelados: 0,
      importados: 0,
      duplicados: 0,
    };
    for (const comprobante of comprobantes) {
      for (const tab of TABS) {
        if (tab.value !== 'todos' && comprobantePerteneceATab(comprobante, tab.value)) {
          conteos[tab.value] += 1;
        }
      }
    }
    return conteos;
  }, [comprobantes]);

  const comprobantesVisibles = React.useMemo(
    () => comprobantes.filter((comprobante) => comprobantePerteneceATab(comprobante, estadoTab)),
    [comprobantes, estadoTab]
  );

  const comprobantesElegibles = comprobantesVisibles.filter(esElegibleParaImportar);
  const todosElegiblesSeleccionados =
    comprobantesElegibles.length > 0 && comprobantesElegibles.every((c) => seleccionados.has(c.id));
  const algunoSeleccionado = seleccionados.size > 0;

  const handleToggleSeleccionTodos = () => {
    setSeleccionados((prev) => {
      if (todosElegiblesSeleccionados) {
        const siguiente = new Set(prev);
        comprobantesElegibles.forEach((c) => siguiente.delete(c.id));
        return siguiente;
      }
      const siguiente = new Set(prev);
      comprobantesElegibles.forEach((c) => siguiente.add(c.id));
      return siguiente;
    });
  };

  const handleToggleSeleccionUno = (comprobanteId: number) => {
    setSeleccionados((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(comprobanteId)) {
        siguiente.delete(comprobanteId);
      } else {
        siguiente.add(comprobanteId);
      }
      return siguiente;
    });
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: 2, borderColor: '#dbe3f0' }}>
      <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack spacing={0.5}>
          <Typography variant="h6" fontWeight={700} color="#1d2f68">
            Comprobantes descargados
          </Typography>
          <Typography variant="body2" color="#4b5563">
            Bandeja de CFDIs ya descargados del SAT. Los comprobantes recibidos tipo Ingreso, no cancelados y con
            XML disponible se pueden importar como factura de compra en borrador.
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
            select
            label="Origen"
            size="small"
            value={filtrosForm.tipo_descarga}
            onChange={(e) => handleFiltroChange('tipo_descarga', e.target.value)}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="emitidos">Emitidos</MenuItem>
            <MenuItem value="recibidos">Recibidos</MenuItem>
          </TextField>

          <TextField
            label="UUID"
            size="small"
            value={filtrosForm.uuid}
            onChange={(e) => handleFiltroChange('uuid', e.target.value)}
          />

          <TextField
            label="RFC emisor"
            size="small"
            value={filtrosForm.rfc_emisor}
            onChange={(e) => handleFiltroChange('rfc_emisor', e.target.value)}
          />

          <TextField
            label="Nombre emisor"
            size="small"
            value={filtrosForm.nombre_emisor}
            onChange={(e) => handleFiltroChange('nombre_emisor', e.target.value)}
          />

          <TextField
            label="RFC receptor"
            size="small"
            value={filtrosForm.rfc_receptor}
            onChange={(e) => handleFiltroChange('rfc_receptor', e.target.value)}
          />

          <TextField
            label="Nombre receptor"
            size="small"
            value={filtrosForm.nombre_receptor}
            onChange={(e) => handleFiltroChange('nombre_receptor', e.target.value)}
          />

          <TextField
            select
            label="Tipo de comprobante"
            size="small"
            value={filtrosForm.tipo_comprobante}
            onChange={(e) => handleFiltroChange('tipo_comprobante', e.target.value)}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="I">Ingreso</MenuItem>
            <MenuItem value="E">Egreso</MenuItem>
            <MenuItem value="T">Traslado</MenuItem>
            <MenuItem value="N">Nómina</MenuItem>
            <MenuItem value="P">Pago</MenuItem>
          </TextField>

          <TextField
            select
            label="Estatus SAT"
            size="small"
            value={filtrosForm.estatus_sat}
            onChange={(e) => handleFiltroChange('estatus_sat', e.target.value)}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="vigente">Vigente</MenuItem>
            <MenuItem value="cancelado">Cancelado</MenuItem>
          </TextField>

          <TextField
            select
            label="Importado a compras"
            size="small"
            value={filtrosForm.importado_compras}
            onChange={(e) => handleFiltroChange('importado_compras', e.target.value)}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="true">Importados</MenuItem>
            <MenuItem value="false">No importados</MenuItem>
          </TextField>

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
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <Button variant="contained" onClick={handleBuscar} sx={{ textTransform: 'none', fontWeight: 700, backgroundColor: '#1d2f68' }}>
            Buscar
          </Button>
          <Button variant="outlined" onClick={handleLimpiar} sx={{ textTransform: 'none' }}>
            Limpiar filtros
          </Button>
          {puedeAdministrar && (
            <Button
              variant="outlined"
              color="success"
              disabled={!algunoSeleccionado}
              onClick={() => setLoteDialogIds(Array.from(seleccionados))}
              sx={{ textTransform: 'none' }}
            >
              Importar seleccionados {algunoSeleccionado ? `(${seleccionados.size})` : ''}
            </Button>
          )}
        </Stack>
        {!puedeAdministrar && (
          <Typography variant="caption" color="#6b7280">
            Solo un administrador de la empresa puede importar o vincular comprobantes a Compras.
          </Typography>
        )}

        {loading ? (
          <Stack alignItems="center" py={4}>
            <CircularProgress size={28} />
          </Stack>
        ) : comprobantes.length === 0 ? (
          <Alert severity="info">No hay comprobantes que coincidan con los filtros.</Alert>
        ) : (
          <>
            <Box>
              <Tabs
                value={estadoTab}
                onChange={(_event, value) => setEstadoTab(value as EstadoTab)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ minHeight: 36, borderBottom: '1px solid #e5e9f2', '& .MuiTab-root': { minHeight: 36, textTransform: 'none' } }}
              >
                {TABS.map((tab) => (
                  <Tab key={tab.value} value={tab.value} label={`${tab.label} (${conteosPorTab[tab.value]})`} />
                ))}
              </Tabs>
              <Typography variant="caption" color="#6b7280">
                El estado operativo y estos conteos se calculan solo sobre la página actual ({comprobantes.length}{' '}
                comprobante{comprobantes.length === 1 ? '' : 's'}).
              </Typography>
            </Box>

            {comprobantesVisibles.length === 0 ? (
              <Alert severity="info">No hay comprobantes en esta página para "{TABS.find((t) => t.value === estadoTab)?.label}".</Alert>
            ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {puedeAdministrar && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={todosElegiblesSeleccionados}
                          indeterminate={algunoSeleccionado && !todosElegiblesSeleccionados}
                          disabled={comprobantesElegibles.length === 0}
                          onChange={handleToggleSeleccionTodos}
                        />
                      </TableCell>
                    )}
                    <TableCell>Fecha</TableCell>
                    <TableCell>UUID</TableCell>
                    <TableCell>Emisor</TableCell>
                    <TableCell>Receptor</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell>Moneda</TableCell>
                    <TableCell>Estatus SAT</TableCell>
                    <TableCell>Origen</TableCell>
                    <TableCell>Estado operativo</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {comprobantesVisibles.map((comprobante) => (
                    <TableRow key={comprobante.id} hover selected={seleccionados.has(comprobante.id)}>
                      {puedeAdministrar && (
                        <TableCell padding="checkbox">
                          <Checkbox
                            size="small"
                            checked={seleccionados.has(comprobante.id)}
                            disabled={!esElegibleParaImportar(comprobante)}
                            onChange={() => handleToggleSeleccionUno(comprobante.id)}
                          />
                        </TableCell>
                      )}
                      <TableCell>{formatFecha(comprobante.fecha_emision)}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{comprobante.uuid}</TableCell>
                      <TableCell>
                        {comprobante.rfc_emisor}
                        {comprobante.nombre_emisor ? ` — ${comprobante.nombre_emisor}` : ''}
                      </TableCell>
                      <TableCell>
                        {comprobante.rfc_receptor}
                        {comprobante.nombre_receptor ? ` — ${comprobante.nombre_receptor}` : ''}
                      </TableCell>
                      <TableCell>{comprobante.tipo_comprobante ?? '—'}</TableCell>
                      <TableCell align="right">
                        {comprobante.total != null
                          ? Number(comprobante.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })
                          : '—'}
                      </TableCell>
                      <TableCell>{comprobante.moneda ?? '—'}</TableCell>
                      <TableCell>
                        {comprobante.estatus_sat ? (
                          <Chip
                            label={comprobante.estatus_sat.toUpperCase()}
                            size="small"
                            color={comprobante.estatus_sat === 'cancelado' ? 'error' : 'success'}
                          />
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell sx={{ textTransform: 'capitalize' }}>{comprobante.tipo_descarga}</TableCell>
                      <TableCell>
                        {comprobante.evaluacion ? (
                          <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
                            <Tooltip title={comprobante.evaluacion.mensaje}>
                              <Chip
                                label={ESTADO_IMPORTACION_INFO[comprobante.evaluacion.estado_importacion_operativo].label}
                                size="small"
                                color={ESTADO_IMPORTACION_INFO[comprobante.evaluacion.estado_importacion_operativo].color}
                              />
                            </Tooltip>
                            {comprobante.evaluacion.posible_documento_existente && (
                              <Tooltip
                                title={`Confianza ${comprobante.evaluacion.posible_documento_existente.confianza}: ${comprobante.evaluacion.posible_documento_existente.motivo}`}
                              >
                                <Chip label={POSIBLE_DUPLICADO_LABEL} size="small" variant="outlined" color="warning" />
                              </Tooltip>
                            )}
                          </Stack>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Button size="small" variant="text" onClick={() => setDetalleId(comprobante.id)} sx={{ textTransform: 'none' }}>
                            Ver
                          </Button>
                          <Button
                            size="small"
                            variant="text"
                            disabled={!comprobante.tiene_xml || descargandoXmlId === comprobante.id}
                            onClick={() => void handleDescargarXml(comprobante)}
                            sx={{ textTransform: 'none' }}
                          >
                            {descargandoXmlId === comprobante.id ? '...' : 'XML'}
                          </Button>
                          {(() => {
                            const evaluacion = comprobante.evaluacion;
                            const estado = evaluacion?.estado_importacion_operativo;
                            const documentoObjetivo = comprobante.documento_id ?? evaluacion?.documento_id ?? null;

                            if (documentoObjetivo && estado && ESTADOS_IMPORTADO.includes(estado)) {
                              return (
                                <Button
                                  size="small"
                                  variant="text"
                                  onClick={() => navigate(`/compras/factura_compra/${documentoObjetivo}`)}
                                  sx={{ textTransform: 'none' }}
                                >
                                  Ver factura
                                </Button>
                              );
                            }

                            if (estado === 'proveedor_no_encontrado') {
                              return (
                                <Button
                                  size="small"
                                  variant="text"
                                  onClick={() => handleCrearProveedor(comprobante)}
                                  sx={{ textTransform: 'none' }}
                                >
                                  Crear proveedor
                                </Button>
                              );
                            }

                            if (estado === 'proveedor_duplicado' || estado === 'proveedor_tipo_invalido') {
                              return (
                                <Button
                                  size="small"
                                  variant="text"
                                  onClick={() => navigate('/contactos')}
                                  sx={{ textTransform: 'none' }}
                                >
                                  Ir a contactos
                                </Button>
                              );
                            }

                            return (
                              <Button
                                size="small"
                                variant="text"
                                disabled={!puedeAdministrar || !esElegibleParaImportar(comprobante)}
                                onClick={() => setImportarDialogId(comprobante.id)}
                                sx={{ textTransform: 'none' }}
                              >
                                Importar
                              </Button>
                            );
                          })()}
                          {puedeAdministrar && puedeVincular(comprobante) && (
                            <Button
                              size="small"
                              variant="text"
                              color="warning"
                              onClick={() => setVincularComprobante(comprobante)}
                              sx={{ textTransform: 'none' }}
                            >
                              Vincular
                            </Button>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            )}

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

      <ComprobanteDetalleDialog comprobanteId={detalleId} onClose={() => setDetalleId(null)} />

      <ImportarComprasDialog
        comprobanteId={importarDialogId}
        rfcEmisor={comprobantes.find((c) => c.id === importarDialogId)?.rfc_emisor ?? null}
        nombreEmisor={comprobantes.find((c) => c.id === importarDialogId)?.nombre_emisor ?? null}
        onClose={() => setImportarDialogId(null)}
        onImportado={() => {
          void cargar();
          onCambio?.();
        }}
      />

      <ImportarLoteComprasDialog
        comprobanteIds={loteDialogIds}
        onClose={() => setLoteDialogIds(null)}
        onFinalizado={() => {
          setSeleccionados(new Set());
          void cargar();
          onCambio?.();
        }}
      />

      <VincularDocumentoDialog
        comprobante={vincularComprobante}
        onClose={() => setVincularComprobante(null)}
        onVinculado={() => {
          void cargar();
          onCambio?.();
        }}
      />
    </Card>
  );
}
