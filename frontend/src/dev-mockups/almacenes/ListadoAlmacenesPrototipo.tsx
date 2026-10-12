import { useMemo, useState } from 'react';
import { Alert, Box, IconButton, InputBase, ListItemIcon, ListItemText, Menu, MenuItem, Snackbar, Typography } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import type { AlmacenMock, FiltroEstado } from './datos';
import { HojaPrototipo } from './HojaPrototipo';

const COLUMNAS = '132px minmax(180px, 1fr) 168px 132px 48px';

export function ListadoAlmacenesPrototipo({
  almacenes,
  aviso,
  onCerrarAviso,
  onNuevo,
  onEditar,
  onAlternar,
}: {
  almacenes: AlmacenMock[];
  aviso: string;
  onCerrarAviso: () => void;
  onNuevo: () => void;
  onEditar: (id: number) => void;
  onAlternar: (id: number) => void;
}) {
  const [texto, setTexto] = useState('');
  const [filtro, setFiltro] = useState<FiltroEstado>('todos');
  const [menu, setMenu] = useState<{ top: number; left: number; almacen: AlmacenMock } | null>(null);

  const conteo = useMemo(() => {
    const activos = almacenes.filter((almacen) => almacen.activo).length;
    return { todos: almacenes.length, activos, inactivos: almacenes.length - activos };
  }, [almacenes]);

  const filas = useMemo(() => {
    const consulta = texto.trim().toLowerCase();
    return almacenes.filter((almacen) => {
      if (filtro === 'activos' && !almacen.activo) return false;
      if (filtro === 'inactivos' && almacen.activo) return false;
      if (!consulta) return true;
      return [almacen.clave, almacen.nombre, almacen.tipo].some((valor) => valor.toLowerCase().includes(consulta));
    });
  }, [almacenes, texto, filtro]);

  const menuActivo = menu?.almacen.activo ?? false;

  return (
    <HojaPrototipo>
      <Box
        sx={(theme) => ({
          display: 'flex',
          alignItems: 'flex-end',
          gap: 3,
          flexWrap: 'wrap',
          px: { xs: 2, md: 2.75 },
          bgcolor: theme.emphasys.action.wash,
          borderBottom: `1px solid ${theme.emphasys.content.border}`,
        })}
      >
        <Box
          sx={(theme) => ({
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            width: { xs: '100%', sm: 248 },
            mb: 1.15,
            pb: 0.45,
            color: theme.emphasys.content.muted,
            borderBottom: `1px solid ${theme.emphasys.content.border}`,
            '&:focus-within': { borderBottomColor: theme.emphasys.content.foreground },
          })}
        >
          <SearchIcon sx={{ fontSize: 16 }} />
          <InputBase
            value={texto}
            onChange={(event) => setTexto(event.target.value)}
            placeholder="Buscar clave, nombre o tipo"
            inputProps={{ 'aria-label': 'Buscar almacenes' }}
            sx={(theme) => ({
              flex: 1,
              fontSize: 13,
              color: theme.emphasys.content.foreground,
              '& input': { p: 0 },
              '& input::placeholder': { color: theme.emphasys.content.muted, opacity: 1 },
            })}
          />
          {texto ? (
            <IconButton size="small" aria-label="Limpiar búsqueda" onClick={() => setTexto('')} sx={{ p: 0.25 }}>
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          ) : null}
        </Box>

        <Box role="tablist" aria-label="Filtrar por estado" sx={{ display: 'flex', gap: { xs: 2, md: 2.75 } }}>
          <Pestana label="Todos" count={conteo.todos} activo={filtro === 'todos'} onClick={() => setFiltro('todos')} />
          <Pestana label="Activos" count={conteo.activos} activo={filtro === 'activos'} onClick={() => setFiltro('activos')} />
          <Pestana label="Inactivos" count={conteo.inactivos} activo={filtro === 'inactivos'} onClick={() => setFiltro('inactivos')} />
        </Box>

        <Box sx={{ flex: '1 1 12px' }} />

        <Box
          component="button"
          type="button"
          onClick={onNuevo}
          sx={(theme) => ({
            mb: 1.05,
            height: 34,
            px: 1.75,
            borderRadius: '6px',
            border: `1px solid ${theme.emphasys.action.primary}`,
            bgcolor: theme.emphasys.action.primary,
            color: theme.emphasys.action.primaryForeground,
            font: 'inherit',
            fontSize: 13,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            '&:hover': { bgcolor: theme.emphasys.action.primaryHover },
          })}
        >
          Nuevo almacén
        </Box>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Box sx={{ minWidth: 720 }}>
          <Box
            sx={(theme) => ({
              display: 'grid',
              gridTemplateColumns: COLUMNAS,
              alignItems: 'center',
              height: 34,
              position: 'sticky',
              top: 0,
              zIndex: 1,
              bgcolor: theme.emphasys.grid.header,
              color: theme.emphasys.grid.headerForeground,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            })}
          >
            <CeldaEncabezado>Clave</CeldaEncabezado>
            <CeldaEncabezado>Nombre</CeldaEncabezado>
            <CeldaEncabezado>Tipo</CeldaEncabezado>
            <CeldaEncabezado>Estado</CeldaEncabezado>
            <span />
          </Box>

          {filas.length === 0 ? (
            <Typography sx={(theme) => ({ px: 2.75, py: 4, fontSize: 13, color: theme.emphasys.content.muted })}>
              {texto || filtro !== 'todos' ? 'Ningún almacén coincide con la búsqueda.' : 'No hay almacenes registrados aún.'}
            </Typography>
          ) : filas.map((almacen, indice) => (
            <Box
              key={almacen.id}
              onDoubleClick={() => onEditar(almacen.id)}
              sx={(theme) => ({
                display: 'grid',
                gridTemplateColumns: COLUMNAS,
                alignItems: 'center',
                height: 42,
                borderBottom: `1px solid ${theme.emphasys.content.border}`,
                bgcolor: indice % 2 === 1 ? theme.emphasys.grid.stripe : 'transparent',
                color: almacen.activo ? theme.emphasys.content.foreground : theme.emphasys.content.muted,
                '&:hover': { bgcolor: theme.emphasys.content.hover },
              })}
            >
              <Typography sx={{ px: 2, fontSize: 13, fontWeight: 650, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em' }}>
                {almacen.clave}
              </Typography>
              <Typography noWrap sx={{ px: 2, fontSize: 13.5 }}>
                {almacen.nombre}
              </Typography>
              <Typography sx={(theme) => ({ px: 2, fontSize: 13, color: almacen.activo ? theme.emphasys.content.secondary : theme.emphasys.table.muted })}>
                {almacen.tipo}
              </Typography>
              <Box sx={{ px: 2, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box
                  component="span"
                  sx={(theme) => ({
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: almacen.activo ? theme.emphasys.metric.applied.foreground : theme.emphasys.table.muted,
                  })}
                />
                <Typography sx={{ fontSize: 13 }}>{almacen.activo ? 'Activo' : 'Inactivo'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <IconButton
                  size="small"
                  aria-label={`Acciones de ${almacen.nombre}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    const rect = event.currentTarget.getBoundingClientRect();
                    setMenu({ top: rect.bottom, left: rect.right, almacen });
                  }}
                  sx={(theme) => ({ color: theme.emphasys.content.muted, '&:hover': { color: theme.emphasys.content.foreground } })}
                >
                  <MoreVertIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      <Box
        sx={(theme) => ({
          display: 'flex',
          alignItems: 'center',
          height: 40,
          px: 2.75,
          borderTop: `1px solid ${theme.emphasys.content.border}`,
          bgcolor: theme.emphasys.action.wash,
          color: theme.emphasys.content.secondary,
          fontSize: 11.5,
          fontVariantNumeric: 'tabular-nums',
        })}
      >
        <Box component="b" sx={(theme) => ({ fontWeight: 650, color: theme.emphasys.content.foreground, mr: 0.5 })}>
          {filas.length}
        </Box>
        {filas.length === 1 ? 'almacén' : 'almacenes'}
        {filas.length !== almacenes.length ? ` de ${almacenes.length}` : ''}
      </Box>

      <Menu
        open={Boolean(menu)}
        onClose={() => setMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={{ top: menu?.top ?? 0, left: menu?.left ?? 0 }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          dense
          onClick={() => {
            const id = menu?.almacen.id;
            setMenu(null);
            if (id != null) onEditar(id);
          }}
        >
          <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Editar</ListItemText>
        </MenuItem>
        <MenuItem
          dense
          onClick={() => {
            const id = menu?.almacen.id;
            setMenu(null);
            if (id != null) onAlternar(id);
          }}
        >
          <ListItemIcon><PowerSettingsNewIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{menuActivo ? 'Desactivar' : 'Activar'}</ListItemText>
        </MenuItem>
      </Menu>

      <Snackbar open={Boolean(aviso)} autoHideDuration={2400} onClose={onCerrarAviso} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" onClose={onCerrarAviso} sx={(theme) => ({ bgcolor: theme.emphasys.frame.background, color: theme.emphasys.frame.foreground })}>
          {aviso}
        </Alert>
      </Snackbar>
    </HojaPrototipo>
  );
}

function CeldaEncabezado({ children }: { children: string }) {
  return <Box component="span" sx={{ px: 2 }}>{children}</Box>;
}

function Pestana({ label, count, activo, onClick }: { label: string; count: number; activo: boolean; onClick: () => void }) {
  return (
    <Box
      component="button"
      type="button"
      role="tab"
      aria-selected={activo}
      onClick={onClick}
      sx={(theme) => ({
        border: 0,
        borderBottom: `2px solid ${activo ? theme.emphasys.content.foreground : 'transparent'}`,
        mb: '-1px',
        background: 'none',
        cursor: 'pointer',
        font: 'inherit',
        fontSize: 13,
        fontWeight: activo ? 700 : 500,
        color: activo ? theme.emphasys.content.foreground : theme.emphasys.content.muted,
        py: '13px',
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 0.75,
      })}
    >
      {label}
      <Box component="span" sx={(theme) => ({ fontSize: 11, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: activo ? theme.emphasys.content.secondary : theme.emphasys.table.muted })}>
        {count}
      </Box>
    </Box>
  );
}
