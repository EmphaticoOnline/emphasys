import React from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputAdornment,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import { useLocation, useNavigate } from 'react-router-dom';
import { EmphasysDataGrid } from '../components/grids/EmphasysDataGrid';
import { STANDARD_DATA_GRID_HEADER_HEIGHT, STANDARD_DATA_GRID_ROW_HEIGHT } from '../components/grids/standardDataGridSx';
import { catalogoSearchSx } from '../components/catalogo/catalogoSurfaces';
import { WorkspaceRowContextMenu, type WorkspaceContextItem } from '../components/documentos/WorkspaceRowContextMenu';
import { actualizarAlmacen, eliminarAlmacen, fetchAlmacenes } from '../services/inventarioService';
import type { Almacen } from '../types/inventario';

type FiltroEstado = 'todos' | 'activos' | 'inactivos';
type Aviso = { open: boolean; message: string; severity: 'success' | 'error' };

const esActivo = (almacen: Almacen) => almacen.activo !== false;

export default function InventarioAlmacenesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const compacto = useMediaQuery(theme.breakpoints.down('md'));

  const [rows, setRows] = React.useState<Almacen[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [texto, setTexto] = React.useState('');
  const [filtro, setFiltro] = React.useState<FiltroEstado>('todos');
  const [paginationModel, setPaginationModel] = React.useState({ page: 0, pageSize: 25 });
  const [seleccionadoId, setSeleccionadoId] = React.useState<number | null>(null);
  const [menu, setMenu] = React.useState<{ top: number; left: number; almacen: Almacen } | null>(null);
  const [pendienteEliminar, setPendienteEliminar] = React.useState<Almacen | null>(null);
  const [eliminando, setEliminando] = React.useState(false);
  const [cambiandoId, setCambiandoId] = React.useState<number | null>(null);
  const [aviso, setAviso] = React.useState<Aviso>({ open: false, message: '', severity: 'success' });

  const cargar = React.useCallback(async () => {
    try {
      setLoading(true);
      setRows(await fetchAlmacenes(true));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los almacenes');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void cargar(); }, [cargar]);

  React.useEffect(() => {
    const state = location.state as { snackbar?: { message?: string; severity?: 'success' | 'error' } } | null;
    const notification = state?.snackbar;
    if (!notification?.message) return;
    setAviso({ open: true, message: notification.message, severity: notification.severity === 'error' ? 'error' : 'success' });
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  // Al cambiar búsqueda o filtro se vuelve a la primera página.
  React.useEffect(() => { setPaginationModel((prev) => ({ ...prev, page: 0 })); }, [texto, filtro]);

  const conteo = React.useMemo(() => {
    const activos = rows.filter(esActivo).length;
    return { todos: rows.length, activos, inactivos: rows.length - activos };
  }, [rows]);

  const filtrados = React.useMemo(() => {
    const consulta = texto.trim().toLowerCase();
    return rows.filter((almacen) => {
      if (filtro === 'activos' && !esActivo(almacen)) return false;
      if (filtro === 'inactivos' && esActivo(almacen)) return false;
      if (!consulta) return true;
      return [almacen.clave, almacen.nombre, almacen.tipo].some((valor) => String(valor ?? '').toLowerCase().includes(consulta));
    });
  }, [rows, texto, filtro]);

  const editar = (almacen: Almacen) => navigate(`/inventario/almacenes/${almacen.id}`);
  const nuevo = () => navigate('/inventario/almacenes/nuevo');

  const alternarActivo = async (almacen: Almacen) => {
    const activar = !esActivo(almacen);
    try {
      setCambiandoId(almacen.id);
      await actualizarAlmacen(almacen.id, {
        clave: almacen.clave ?? '',
        nombre: almacen.nombre,
        tipo: almacen.tipo ?? 'normal',
        activo: activar,
      });
      setAviso({ open: true, message: activar ? 'Almacén activado' : 'Almacén desactivado', severity: 'success' });
      await cargar();
    } catch (e) {
      setAviso({ open: true, message: e instanceof Error ? e.message : 'No se pudo actualizar el almacén', severity: 'error' });
    } finally {
      setCambiandoId(null);
    }
  };

  const confirmarEliminar = async () => {
    if (!pendienteEliminar || eliminando) return;
    try {
      setEliminando(true);
      await eliminarAlmacen(pendienteEliminar.id);
      if (seleccionadoId === pendienteEliminar.id) setSeleccionadoId(null);
      setAviso({ open: true, message: 'Almacén eliminado', severity: 'success' });
      setPendienteEliminar(null);
      await cargar();
    } catch (e) {
      setAviso({ open: true, message: e instanceof Error ? e.message : 'No se pudo eliminar el almacén', severity: 'error' });
    } finally {
      setEliminando(false);
    }
  };

  const seleccionado = rows.find((almacen) => almacen.id === seleccionadoId) ?? null;
  const ocupado = cambiandoId != null || eliminando;

  React.useEffect(() => {
    if (seleccionadoId != null && !filtrados.some((almacen) => almacen.id === seleccionadoId)) {
      setSeleccionadoId(null);
    }
  }, [filtrados, seleccionadoId]);

  const abrirMenu = (event: React.MouseEvent, almacen: Almacen) => {
    event.preventDefault();
    setSeleccionadoId(almacen.id);
    setMenu({ top: event.clientY, left: event.clientX, almacen });
  };

  const itemsMenu = (almacen: Almacen): WorkspaceContextItem[] => {
    const activo = esActivo(almacen);
    const bloqueado = ocupado;
    return [
      { id: 'nuevo', label: 'Nuevo almacén', icon: <AddIcon fontSize="small" />, onClick: nuevo },
      { id: 'editar', label: 'Editar', icon: <EditIcon fontSize="small" />, disabled: bloqueado, onClick: bloqueado ? undefined : () => editar(almacen) },
      { id: 'eliminar', label: 'Eliminar', icon: <DeleteOutlineIcon fontSize="small" />, disabled: bloqueado, onClick: bloqueado ? undefined : () => setPendienteEliminar(almacen) },
      {
        id: 'estado',
        label: activo ? 'Desactivar' : 'Activar',
        icon: <PowerSettingsNewIcon fontSize="small" />,
        disabled: bloqueado,
        onClick: bloqueado ? undefined : () => { void alternarActivo(almacen); },
      },
    ];
  };

  const columns: GridColDef<Almacen>[] = [
    { field: 'clave', headerName: 'Clave', width: compacto ? 110 : 160, valueGetter: (_value, row) => row.clave || '—' },
    { field: 'nombre', headerName: 'Nombre', flex: 1, minWidth: 180 },
    ...(compacto ? [] : [
      { field: 'tipo', headerName: 'Tipo', width: 200, valueGetter: (_value: unknown, row: Almacen) => row.tipo || 'normal' } as GridColDef<Almacen>,
    ]),
    {
      field: 'activo',
      headerName: 'Estado',
      width: compacto ? 100 : 140,
      valueGetter: (_value, row) => (esActivo(row) ? 'Activo' : 'Inactivo'),
      renderCell: (params: GridRenderCellParams<Almacen>) => (
        <Typography variant="body2" sx={{ fontSize: 13, color: esActivo(params.row) ? 'text.primary' : 'text.secondary' }}>
          {esActivo(params.row) ? 'Activo' : 'Inactivo'}
        </Typography>
      ),
    },
  ];

  return (
    <Box sx={{ width: '100%', px: { xs: 1.5, md: 3 }, pt: 2, pb: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Encabezado + toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, flexShrink: 0 }}>
          <Typography variant="h5" fontWeight={700} color="primary.main">Almacenes</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            {conteo.todos} · {conteo.activos} {conteo.activos === 1 ? 'activo' : 'activos'}
          </Typography>
        </Box>
        <TextField
          size="small"
          placeholder="Buscar clave, nombre o tipo..."
          value={texto}
          onChange={(event) => setTexto(event.target.value)}
          sx={(fieldTheme) => ({
            flex: '1 1 260px',
            minWidth: 200,
            ...(typeof catalogoSearchSx === 'function' ? catalogoSearchSx(fieldTheme) : {}),
          })}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: texto ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setTexto('')} aria-label="Limpiar búsqueda">
                  <CloseIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
        <ToggleButtonGroup
          size="small"
          exclusive
          value={filtro}
          onChange={(_e, value: FiltroEstado | null) => { if (value) setFiltro(value); }}
          aria-label="Filtrar por estado"
          sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontSize: 13, px: 1.5, py: 0.5 } }}
        >
          <ToggleButton value="todos">Todos ({conteo.todos})</ToggleButton>
          <ToggleButton value="activos">Activos ({conteo.activos})</ToggleButton>
          <ToggleButton value="inactivos">Inactivos ({conteo.inactivos})</ToggleButton>
        </ToggleButtonGroup>
        <Stack direction="row" spacing={0.5} alignItems="center" useFlexGap sx={{ flexShrink: 0 }}>
          <AccionAlmacen title="Nuevo almacén" onClick={nuevo} icon={<AddIcon fontSize="small" />} />
          <AccionAlmacen
            title={seleccionado ? 'Editar almacén' : 'Selecciona un almacén'}
            disabled={!seleccionado || ocupado}
            onClick={() => { if (seleccionado) editar(seleccionado); }}
            icon={<EditIcon fontSize="small" />}
          />
          <AccionAlmacen
            title={seleccionado ? 'Eliminar almacén' : 'Selecciona un almacén'}
            disabled={!seleccionado || ocupado}
            onClick={() => { if (seleccionado) setPendienteEliminar(seleccionado); }}
            icon={<DeleteOutlineIcon fontSize="small" />}
          />
          <AccionAlmacen
            title={!seleccionado ? 'Selecciona un almacén' : esActivo(seleccionado) ? 'Desactivar almacén' : 'Activar almacén'}
            disabled={!seleccionado || ocupado}
            onClick={() => { if (seleccionado) void alternarActivo(seleccionado); }}
            icon={<PowerSettingsNewIcon fontSize="small" />}
          />
        </Stack>
      </Box>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      {/* Grid */}
      <Box sx={{
        width: '100%',
        backgroundColor: theme.emphasys.content.card,
        borderRadius: 2,
        border: `1px solid ${theme.emphasys.content.border}`,
        overflow: 'hidden',
      }}>
        <EmphasysDataGrid<Almacen>
          rows={filtrados}
          columns={columns}
          getRowId={(row) => row.id}
          autoHeight
          rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
          columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
          loading={loading}
          disableMultipleRowSelection
          rowSelectionModel={seleccionadoId == null ? [] : [seleccionadoId]}
          onRowClick={(params) => {
            const id = Number(params.id);
            if (Number.isInteger(id)) setSeleccionadoId(id);
          }}
          onRowSelectionModelChange={(model) => {
            const ids = model.map((value) => Number(value)).filter((value) => Number.isInteger(value));
            const siguiente = ids[ids.length - 1];
            if (siguiente == null) return;
            setSeleccionadoId(siguiente);
          }}
          onRowDoubleClick={(params) => editar(params.row)}
          slotProps={{
            cell: {
              onFocus: (event: React.FocusEvent<HTMLDivElement>) => {
                const fila = event.currentTarget.closest('[role="row"]');
                const id = Number(fila?.getAttribute('data-id'));
                if (!Number.isInteger(id)) return;
                setSeleccionadoId((actual) => (actual === id ? actual : id));
              },
            },
            row: {
              onContextMenu: (event: React.MouseEvent<HTMLDivElement>) => {
                const id = Number(event.currentTarget.getAttribute('data-id'));
                const almacen = rows.find((item) => item.id === id);
                if (!almacen) return;
                abrirMenu(event, almacen);
              },
            },
          }}
          initialState={{ sorting: { sortModel: [{ field: 'clave', sort: 'asc' }] } }}
          pagination
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[25, 50, 100]}
          hideFooterSelectedRowCount
          localeText={{
            ...esES.components.MuiDataGrid.defaultProps.localeText,
            noRowsLabel: texto || filtro !== 'todos' ? 'Ningún almacén coincide con la búsqueda.' : 'No hay almacenes registrados aún.',
          }}
          sx={{
            width: '100%',
            border: 0,
            '--DataGrid-overlayHeight': '160px',
            '& .MuiDataGrid-cell': {
              display: 'flex',
              alignItems: 'center',
              borderColor: theme.emphasys.content.border,
            },
            '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': {
              outline: 'none !important',
            },
            '& .MuiDataGrid-row.Mui-selected, & .MuiDataGrid-row.Mui-selected:hover': {
              backgroundColor: `${theme.emphasys.grid.selected} !important`,
              boxShadow: `inset 3px 0 0 ${theme.emphasys.action.primary}`,
            },
            '& .MuiDataGrid-row.Mui-selected:hover': {
              backgroundColor: `${theme.emphasys.grid.selectedHover} !important`,
            },
            '& .MuiDataGrid-footerContainer': {
              borderTop: `1px solid ${theme.emphasys.content.border}`,
              backgroundColor: theme.emphasys.content.card,
              color: theme.emphasys.content.secondary,
              minHeight: 44,
            },
            '& .MuiTablePagination-root, & .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
              color: theme.emphasys.content.secondary,
            },
            '& .MuiTablePagination-selectIcon': {
              color: theme.emphasys.content.muted,
            },
          }}
        />
      </Box>

      <WorkspaceRowContextMenu
        anchorPosition={menu ? { top: menu.top, left: menu.left } : null}
        items={menu ? itemsMenu(menu.almacen) : []}
        onClose={() => setMenu(null)}
      />

      <Dialog open={Boolean(pendienteEliminar)} onClose={() => { if (!eliminando) setPendienteEliminar(null); }}>
        <DialogTitle>Eliminar almacén</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Eliminar {pendienteEliminar?.clave ? `${pendienteEliminar.clave} · ` : ''}{pendienteEliminar?.nombre}?
            Solo se elimina si no tiene movimientos, existencias, documentos ni otra referencia. Esta acción no se puede deshacer.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendienteEliminar(null)} disabled={eliminando}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={() => void confirmarEliminar()} disabled={eliminando}>
            {eliminando ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={aviso.open} autoHideDuration={3000} onClose={() => setAviso((prev) => ({ ...prev, open: false }))}>
        <Alert severity={aviso.severity} onClose={() => setAviso((prev) => ({ ...prev, open: false }))}>{aviso.message}</Alert>
      </Snackbar>
    </Box>
  );
}

function AccionAlmacen({ title, disabled = false, onClick, icon }: { title: string; disabled?: boolean; onClick: () => void; icon: React.ReactNode }) {
  const tokens = useTheme().emphasys;
  const iconoSx = {
    width: 34,
    height: 34,
    borderRadius: '10px',
    bgcolor: disabled ? tokens.action.disabled : tokens.action.primary,
    color: tokens.action.primaryForeground,
    '&:hover': { bgcolor: disabled ? tokens.action.disabled : tokens.action.primaryHover },
    '&.Mui-disabled': { bgcolor: tokens.action.disabled, color: tokens.action.primaryForeground },
  };
  return (
    <Tooltip title={title} arrow>
      <span>
        <IconButton size="small" aria-label={title} disabled={disabled} onClick={onClick} sx={iconoSx}>
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );
}
