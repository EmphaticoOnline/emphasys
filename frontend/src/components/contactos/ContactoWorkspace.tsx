import * as React from 'react';
import {
  Box,
  CircularProgress,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import { catalogoTabsSx } from '../catalogo/catalogoSurfaces';
import EditIcon from '@mui/icons-material/Edit';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import UpdateOutlinedIcon from '@mui/icons-material/UpdateOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import { getContacto } from '../../services/contactos.api';
import { MOVIMIENTOS_CONTACTO } from '../documentos/movimientos/movimientosContacto.config';
import { useMovimientosContacto } from '../documentos/movimientos/useMovimientosContacto';
import DocumentosMovimientoLista from '../documentos/movimientos/DocumentosMovimientoLista';
import type { ContactoDetalle } from '../../types/contactos.types';
import type { ContactoRow } from './ContactosView.types';
import { formatearTelefonoParaMostrar } from '../../utils/telefono';
import ProductoHistorialComercial from '../productos/ProductoHistorialComercial';

type ContactoWorkspaceProps = {
  contactoId: number | null;
  vendedorNombre: Map<number, string>;
  onEditar: (contactoId: number) => void;
  onEliminar: (contactoId: number) => void;
  onVerActividades: (contacto: ContactoRow) => void;
  /** Solo en móvil: regresa a la lista de contactos. */
  onVolver?: () => void;
};

/** Pestañas fijas; las de documentos usan el tipoDocumento como clave. */
type TabFija = 'datos' | 'domicilios' | 'contactos' | 'compras' | 'ventas';

const currencyFormatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const dateFormatter = new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });
const dateTimeFormatter = new Intl.DateTimeFormat('es-MX', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

function formatCurrency(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return null;
  return currencyFormatter.format(numeric);
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return dateFormatter.format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return dateTimeFormatter.format(date);
}

function getInitials(nombre: string) {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  const [first, second] = parts;
  if (!first) return '?';
  if (!second) return first.slice(0, 2).toUpperCase();
  return `${first[0] ?? ''}${second[0] ?? ''}`.toUpperCase();
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 2, py: 0.75 }}>
      <Typography variant="body2" sx={{ color: (theme) => theme.emphasys.content.muted }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} sx={{ textAlign: 'right', wordBreak: 'break-word', color: (theme) => theme.emphasys.content.foreground }}>
        {value || value === 0 ? value : '—'}
      </Typography>
    </Box>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Box
      sx={{
        flex: '1 1 200px',
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        borderRadius: 2,
        p: 1.5,
        backgroundColor: (theme) => theme.emphasys.metric.amount.background,
      }}
    >
      <Box sx={{ color: (theme) => theme.emphasys.content.foreground, display: 'flex' }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" sx={{ display: 'block', letterSpacing: 0.4, textTransform: 'uppercase', color: (theme) => theme.emphasys.content.muted }}>
          {label}
        </Typography>
        <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ color: (theme) => theme.emphasys.content.foreground }}>
          {value}
        </Typography>
      </Box>
    </Box>
  );
}

export default function ContactoWorkspace({ contactoId, vendedorNombre, onEditar, onEliminar, onVerActividades, onVolver }: ContactoWorkspaceProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [detalle, setDetalle] = React.useState<ContactoDetalle | null>(null);
  const [tab, setTab] = React.useState<string>('datos' satisfies TabFija);
  const movimientos = useMovimientosContacto(contactoId);
  const [historialDesde, setHistorialDesde] = React.useState('');
  const [historialHasta, setHistorialHasta] = React.useState('');
  const [offsetCompras, setOffsetCompras] = React.useState(0);
  const [offsetVentas, setOffsetVentas] = React.useState(0);

  React.useEffect(() => {
    setTab('datos');
    if (!contactoId) {
      setDetalle(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    getContacto(contactoId)
      .then((data) => {
        if (!active) return;
        if (data && typeof data === 'object' && 'contacto' in data) {
          setDetalle(data as ContactoDetalle);
        } else {
          setDetalle({ contacto: data as ContactoDetalle['contacto'], domicilio_principal: null, datos_fiscales: null });
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'No se pudo cargar el contacto');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [contactoId]);

  React.useEffect(() => {
    setHistorialDesde('');
    setHistorialHasta('');
    setOffsetCompras(0);
    setOffsetVentas(0);
  }, [contactoId]);

  if (!contactoId) {
    return (
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: (theme) => theme.emphasys.content.background,
        }}
      >
        <Box sx={{ textAlign: 'center', px: 3 }}>
          <PersonOutlineOutlinedIcon sx={{ fontSize: 40, color: (theme) => theme.emphasys.content.muted, mb: 1 }} />
          <Typography variant="body1" fontWeight={600} sx={{ color: (theme) => theme.emphasys.content.secondary }}>
            Selecciona un contacto
          </Typography>
          <Typography variant="body2" sx={{ color: (theme) => theme.emphasys.content.muted }}>
            Elige un contacto de la lista para ver su información.
          </Typography>
        </Box>
      </Box>
    );
  }

  if (loading || !detalle) {
    return (
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: (theme) => theme.emphasys.content.background,
        }}
      >
        {error ? (
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        ) : (
          <CircularProgress size={28} />
        )}
      </Box>
    );
  }

  const { contacto, domicilio_principal, datos_fiscales } = detalle;
  const vendedorAsignado = contacto.vendedor_id ? vendedorNombre.get(Number(contacto.vendedor_id)) : null;
  const historialComercial = tab === 'compras' || tab === 'ventas';
  const cotizacionesTotal = movimientos.estado.cotizacion?.total ?? null;
  // Sólo se muestran pestañas de documentos con al menos un movimiento.
  const movimientosVisibles = MOVIMIENTOS_CONTACTO.filter((config) => (movimientos.estado[config.tipoDocumento]?.total ?? 0) > 0);
  const movimientoActivo = MOVIMIENTOS_CONTACTO.find((config) => config.tipoDocumento === tab) ?? null;
  const tieneDomicilio = Boolean(
    domicilio_principal &&
      (domicilio_principal.calle || domicilio_principal.colonia || domicilio_principal.ciudad || domicilio_principal.cp)
  );
  const limiteCredito = formatCurrency(contacto.limite_credito);
  const diasCredito = contacto.dias_credito !== null && contacto.dias_credito !== undefined ? `${contacto.dias_credito} días` : null;
  const ultimaActualizacion = formatDate(contacto.updated_at);

  return (
    <Box sx={(theme) => ({ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', bgcolor: theme.emphasys.content.background, overflow: 'hidden' })}>
      {onVolver ? (
        <Box
          component="button"
          type="button"
          onClick={onVolver}
          sx={(theme) => ({ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 0.5, border: 0, bgcolor: 'transparent', color: theme.emphasys.content.foreground, font: 'inherit', cursor: 'pointer', mx: 1.5, mt: 1, p: 0 })}
        >
          <ArrowBackIcon fontSize="small" /> Contactos
        </Box>
      ) : null}
      <Box sx={{ px: { xs: 1.5, md: 2.75 }, pt: onVolver ? 0.5 : 1.6, pb: 1.4, display: 'flex', gap: 1.5, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={(theme) => ({ fontSize: 11, letterSpacing: '0.14em', fontWeight: 700, color: theme.emphasys.content.muted })}>
            CONTACTO SELECCIONADO
          </Typography>
          <Typography variant="figure" sx={(theme) => ({ display: 'block', mt: 0.35, fontSize: { xs: 26, md: 32 }, letterSpacing: '-0.02em', lineHeight: 1, color: theme.emphasys.content.foreground })}>
            {contacto.nombre}
          </Typography>
          <Typography variant="figure" sx={(theme) => ({ display: 'block', mt: 0.7, fontSize: 15, lineHeight: 1.3, color: theme.emphasys.content.foreground })}>
            {[contacto.nombre_contacto, formatearTelefonoParaMostrar(contacto.telefono), vendedorAsignado].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
          </Typography>
          <Stack direction="row" spacing={0.7} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
            {contacto.tipo_contacto ? (
              <Box component="span" sx={(theme) => ({ display: 'inline-flex', alignItems: 'center', height: 26, px: 1.05, borderRadius: 99, bgcolor: theme.emphasys.metric.amount.background, color: theme.emphasys.content.foreground, fontSize: 12, fontWeight: 700 })}>
                {contacto.tipo_contacto}
              </Box>
            ) : null}
            <Box component="span" sx={(theme) => ({ display: 'inline-flex', alignItems: 'center', height: 26, px: 1.05, borderRadius: 99, bgcolor: theme.emphasys.content.elevated, color: theme.emphasys.content.foreground, fontSize: 12, fontWeight: 700 })}>
              {contacto.activo ? 'Activo' : 'Inactivo'}
            </Box>
          </Stack>
        </Box>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Ver actividades">
            <IconButton
              size="small"
              sx={(theme) => ({ width: 34, height: 34, borderRadius: '10px', bgcolor: theme.emphasys.action.primary, color: theme.emphasys.action.primaryForeground, '&:hover': { bgcolor: theme.emphasys.action.primaryHover } })}
              onClick={() =>
                onVerActividades({
                  ...(contacto as ContactoRow),
                  vendedor_nombre: vendedorAsignado ?? null,
                })
              }
            >
              <EventNoteOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Editar contacto">
            <IconButton
              size="small"
              sx={(theme) => ({ width: 34, height: 34, borderRadius: '10px', bgcolor: theme.emphasys.action.primary, color: theme.emphasys.action.primaryForeground, '&:hover': { bgcolor: theme.emphasys.action.primaryHover } })}
              onClick={() => onEditar(contacto.id)}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Eliminar contacto">
            <IconButton
              size="small"
              sx={(theme) => ({ width: 34, height: 34, borderRadius: '10px', bgcolor: theme.emphasys.action.primary, color: theme.emphasys.action.primaryForeground, '&:hover': { bgcolor: theme.emphasys.action.primaryHover } })}
              onClick={() => onEliminar(contacto.id)}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      <Box sx={(theme) => ({ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', mx: { xs: 1, md: 1.75 }, mb: { xs: 1, md: 1.75 }, bgcolor: theme.emphasys.content.well, borderRadius: 3, border: `1px solid ${theme.emphasys.content.border}`, overflow: 'hidden' })}>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto" sx={catalogoTabsSx}>
          <Tab value="datos" label="Datos generales" />
          <Tab value="domicilios" label={`Domicilios${tieneDomicilio ? ' (1)' : ''}`} />
          <Tooltip title="Función en desarrollo">
            <span>
              <Tab value="contactos" label="Contactos adicionales" disabled />
            </span>
          </Tooltip>
          {movimientosVisibles.map((config) => (
            <Tab key={config.tipoDocumento} value={config.tipoDocumento} label={`${config.etiqueta} (${movimientos.estado[config.tipoDocumento]?.total ?? 0})`} />
          ))}
          <Tab value="compras" label="Últimas compras" />
          <Tab value="ventas" label="Últimas ventas" />
        </Tabs>
      <Box
        sx={{
          p: historialComercial ? 0 : { xs: 1.5, md: 2.25 },
          overflowY: 'auto',
          flex: 1,
          minHeight: 0,
          display: historialComercial ? 'flex' : 'block',
        }}
      >
        {tab === 'datos' && (
          <Stack spacing={2.5}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
              {limiteCredito ? (
                <StatCard icon={<CreditCardOutlinedIcon />} label="Línea de crédito" value={limiteCredito} />
              ) : null}
              {diasCredito ? (
                <StatCard icon={<CalendarMonthOutlinedIcon />} label="Días de crédito" value={diasCredito} />
              ) : null}
              {cotizacionesTotal !== null ? (
                <StatCard icon={<DescriptionOutlinedIcon />} label="Cotizaciones" value={String(cotizacionesTotal)} />
              ) : null}
              {ultimaActualizacion ? (
                <StatCard icon={<UpdateOutlinedIcon />} label="Última actualización" value={ultimaActualizacion} />
              ) : null}
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                gap: 3,
              }}
            >
              <Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5, letterSpacing: 0.4, color: (theme) => theme.emphasys.content.foreground }}>
                  INFORMACIÓN FISCAL
                </Typography>
                <InfoRow label="Razón social" value={contacto.nombre} />
                <InfoRow label="RFC" value={contacto.rfc || datos_fiscales?.rfc} />
                <InfoRow label="Régimen fiscal" value={datos_fiscales?.regimen_fiscal} />
                <InfoRow label="Tipo de contacto" value={contacto.tipo_contacto} />
                <InfoRow label="Clasificación" value={contacto.clasificacion_descripcion || contacto.clasificacion} />
              </Box>

              <Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5, letterSpacing: 0.4, color: (theme) => theme.emphasys.content.foreground }}>
                  SEGUIMIENTO COMERCIAL
                </Typography>
                <InfoRow label="Vendedor asignado" value={vendedorAsignado} />
                <InfoRow label="Origen del contacto" value={contacto.origen_contacto_descripcion || contacto.origen_contacto} />
                <InfoRow label="Activo" value={contacto.activo ? 'Sí' : 'No'} />
                <InfoRow label="Alta en sistema" value={formatDateTime(contacto.fecha_alta)} />
              </Box>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                gap: 3,
              }}
            >
              <Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5, letterSpacing: 0.4, color: (theme) => theme.emphasys.content.foreground }}>
                  CONTACTO PRINCIPAL
                </Typography>
                <InfoRow label="Nombre" value={contacto.nombre_contacto} />
                <InfoRow label="Teléfono" value={formatearTelefonoParaMostrar(contacto.telefono)} />
                <InfoRow label="Teléfono secundario" value={formatearTelefonoParaMostrar(contacto.telefono_secundario)} />
                <InfoRow label="Correo" value={contacto.email} />
              </Box>

              {contacto.observaciones ? (
                <Box>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5, letterSpacing: 0.4, color: (theme) => theme.emphasys.content.foreground }}>
                    OBSERVACIONES
                  </Typography>
                  <Box sx={{ border: (theme) => `1px solid ${theme.emphasys.content.border}`, borderRadius: 1.5, p: 1.5, backgroundColor: (theme) => theme.emphasys.content.elevated }}>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: (theme) => theme.emphasys.content.foreground }}>
                      {contacto.observaciones}
                    </Typography>
                  </Box>
                </Box>
              ) : null}
            </Box>
          </Stack>
        )}

        {tab === 'domicilios' && (
          <Box>
            {tieneDomicilio ? (
              <Box sx={{ border: (theme) => `1px solid ${theme.emphasys.content.border}`, borderRadius: 1.5, p: 2, maxWidth: 480 }}>
                <InfoRow label="Calle y número" value={[domicilio_principal?.calle, domicilio_principal?.numero_exterior].filter(Boolean).join(' ')} />
                <InfoRow label="Colonia" value={domicilio_principal?.colonia} />
                <InfoRow label="Ciudad" value={domicilio_principal?.ciudad} />
                <InfoRow label="Estado" value={domicilio_principal?.estado} />
                <InfoRow label="Código postal" value={domicilio_principal?.cp} />
                <InfoRow label="País" value={domicilio_principal?.pais} />
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: (theme) => theme.emphasys.content.muted }}>
                Este contacto no tiene un domicilio registrado.
              </Typography>
            )}
          </Box>
        )}

        {tab === 'contactos' && (
          <Typography variant="body2" sx={{ color: (theme) => theme.emphasys.content.muted }}>
            La gestión de contactos adicionales estará disponible próximamente.
          </Typography>
        )}

        {movimientoActivo && (
          <DocumentosMovimientoLista
            config={movimientoActivo}
            estado={movimientos.estado[movimientoActivo.tipoDocumento]}
            onCargarMas={() => movimientos.cargarMas(movimientoActivo.tipoDocumento)}
          />
        )}

        {historialComercial && (
          <ProductoHistorialComercial
            entidad="contacto"
            entidadId={contacto.id}
            modo={tab === 'compras' ? 'compras' : 'ventas'}
            desde={historialDesde}
            hasta={historialHasta}
            offset={tab === 'compras' ? offsetCompras : offsetVentas}
            onDesde={(valor) => {
              setHistorialDesde(valor);
              setOffsetCompras(0);
              setOffsetVentas(0);
            }}
            onHasta={(valor) => {
              setHistorialHasta(valor);
              setOffsetCompras(0);
              setOffsetVentas(0);
            }}
            onOffset={tab === 'compras' ? setOffsetCompras : setOffsetVentas}
          />
        )}
      </Box>
      </Box>
    </Box>
  );
}
