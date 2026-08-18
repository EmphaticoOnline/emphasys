import * as React from 'react';
import {
  Avatar,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import UpdateOutlinedIcon from '@mui/icons-material/UpdateOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import { getContacto } from '../../services/contactos.api';
import { getDocumentosPaginados } from '../../services/documentosService';
import type { CotizacionListado } from '../../types/cotizacion';
import type { ContactoDetalle } from '../../types/contactos.types';
import type { ContactoRow } from './ContactosView.types';
import { formatearTelefonoParaMostrar } from '../../utils/telefono';

type ContactoWorkspaceProps = {
  contactoId: number | null;
  vendedorNombre: Map<number, string>;
  onEditar: (contactoId: number) => void;
  onEliminar: (contactoId: number) => void;
  onVerActividades: (contacto: ContactoRow) => void;
};

const currencyFormatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const dateFormatter = new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });

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

function getInitials(nombre: string) {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 2, py: 0.75 }}>
      <Typography variant="body2" color="#6b7280">
        {label}
      </Typography>
      <Typography variant="body2" color="#111827" fontWeight={600} sx={{ textAlign: 'right', wordBreak: 'break-word' }}>
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
        border: '1px solid #e5e7eb',
        borderRadius: 2,
        p: 1.5,
        backgroundColor: '#fff',
      }}
    >
      <Box sx={{ color: '#1d2f68', display: 'flex' }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="#6b7280" sx={{ display: 'block', letterSpacing: 0.4, textTransform: 'uppercase' }}>
          {label}
        </Typography>
        <Typography variant="subtitle1" fontWeight={700} color="#111827" noWrap>
          {value}
        </Typography>
      </Box>
    </Box>
  );
}

function EstatusChip({ estatus }: { estatus?: string | null }) {
  if (!estatus) return null;
  return <Chip size="small" label={estatus} sx={{ fontWeight: 600 }} />;
}

function DocumentosMiniLista({
  loading,
  documentos,
  emptyLabel,
  codigo,
}: {
  loading: boolean;
  documentos: CotizacionListado[];
  emptyLabel: string;
  codigo: string;
}) {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={22} />
      </Box>
    );
  }

  if (documentos.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="#6b7280">
          {emptyLabel}
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={1}>
      {documentos.map((doc) => (
        <Box
          key={doc.id}
          component="a"
          href={`/ventas/${codigo}/${doc.id}`}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            border: '1px solid #e5e7eb',
            borderRadius: 1.5,
            px: 1.5,
            py: 1,
            textDecoration: 'none',
            color: 'inherit',
            '&:hover': { backgroundColor: '#f8fafc' },
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={700} color="#1d2f68">
              {doc.serie ? `${doc.serie}-${doc.numero ?? ''}` : `#${doc.numero ?? doc.id}`}
            </Typography>
            <Typography variant="caption" color="#6b7280">
              {formatDate(doc.fecha_documento) || ''}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <EstatusChip estatus={doc.estatus_documento} />
            <Typography variant="body2" fontWeight={700} color="#111827">
              {formatCurrency(doc.total) || ''}
            </Typography>
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

export default function ContactoWorkspace({ contactoId, vendedorNombre, onEditar, onEliminar, onVerActividades }: ContactoWorkspaceProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [detalle, setDetalle] = React.useState<ContactoDetalle | null>(null);
  const [tab, setTab] = React.useState(0);
  const [cotizaciones, setCotizaciones] = React.useState<CotizacionListado[]>([]);
  const [cotizacionesTotal, setCotizacionesTotal] = React.useState(0);
  const [cotizacionesLoading, setCotizacionesLoading] = React.useState(false);
  const [facturas, setFacturas] = React.useState<CotizacionListado[]>([]);
  const [facturasTotal, setFacturasTotal] = React.useState(0);
  const [facturasLoading, setFacturasLoading] = React.useState(false);

  React.useEffect(() => {
    setTab(0);
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
    if (!contactoId) {
      setCotizaciones([]);
      setCotizacionesTotal(0);
      setFacturas([]);
      setFacturasTotal(0);
      return;
    }

    let active = true;
    setCotizacionesLoading(true);
    getDocumentosPaginados('cotizacion', { page: 1, limit: 8, clienteId: contactoId })
      .then((response) => {
        if (!active) return;
        setCotizaciones(response.data as unknown as CotizacionListado[]);
        setCotizacionesTotal(response.total);
      })
      .catch(() => {
        if (!active) return;
        setCotizaciones([]);
        setCotizacionesTotal(0);
      })
      .finally(() => {
        if (active) setCotizacionesLoading(false);
      });

    setFacturasLoading(true);
    getDocumentosPaginados('factura', { page: 1, limit: 8, clienteId: contactoId })
      .then((response) => {
        if (!active) return;
        setFacturas(response.data as unknown as CotizacionListado[]);
        setFacturasTotal(response.total);
      })
      .catch(() => {
        if (!active) return;
        setFacturas([]);
        setFacturasTotal(0);
      })
      .finally(() => {
        if (active) setFacturasLoading(false);
      });

    return () => {
      active = false;
    };
  }, [contactoId]);

  if (!contactoId) {
    return (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #e5e7eb',
          borderRadius: 2,
          backgroundColor: '#fff',
          minHeight: 400,
        }}
      >
        <Box sx={{ textAlign: 'center', px: 3 }}>
          <PersonOutlineOutlinedIcon sx={{ fontSize: 40, color: '#cbd5e1', mb: 1 }} />
          <Typography variant="body1" color="#4b5563" fontWeight={600}>
            Selecciona un contacto
          </Typography>
          <Typography variant="body2" color="#9ca3af">
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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #e5e7eb',
          borderRadius: 2,
          backgroundColor: '#fff',
          minHeight: 400,
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
  const tieneDomicilio = Boolean(
    domicilio_principal &&
      (domicilio_principal.calle || domicilio_principal.colonia || domicilio_principal.ciudad || domicilio_principal.cp)
  );
  const limiteCredito = formatCurrency(contacto.limite_credito);
  const diasCredito = contacto.dias_credito !== null && contacto.dias_credito !== undefined ? `${contacto.dias_credito} días` : null;
  const ultimaActualizacion = formatDate(contacto.updated_at);

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, border: '1px solid #e5e7eb', borderRadius: 2, backgroundColor: '#fff', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ p: 2.5, borderBottom: '1px solid #e5e7eb' }}>
        <Stack direction="row" spacing={2} alignItems="flex-start" justifyContent="space-between">
          <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ minWidth: 0 }}>
            <Avatar sx={{ bgcolor: '#1d2f68', color: '#fff', fontWeight: 700 }}>{getInitials(contacto.nombre)}</Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography variant="h6" fontWeight={700} color="#111827" sx={{ lineHeight: 1.2 }}>
                  {contacto.nombre}
                </Typography>
                {contacto.tipo_contacto ? (
                  <Chip size="small" label={contacto.tipo_contacto.toUpperCase()} sx={{ fontWeight: 700, backgroundColor: '#eef1f4' }} />
                ) : null}
              </Stack>
              <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mt: 0.5 }}>
                {contacto.nombre_contacto ? (
                  <Typography variant="body2" color="#4b5563">
                    {contacto.nombre_contacto}
                  </Typography>
                ) : null}
                {contacto.telefono ? (
                  <Typography variant="body2" color="#4b5563">
                    {formatearTelefonoParaMostrar(contacto.telefono)}
                  </Typography>
                ) : null}
                {vendedorAsignado ? (
                  <Typography variant="body2" color="#4b5563">
                    {vendedorAsignado}
                  </Typography>
                ) : null}
              </Stack>
            </Box>
          </Stack>
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Ver actividades">
              <IconButton
                size="small"
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
              <IconButton size="small" onClick={() => onEditar(contacto.id)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Eliminar contacto">
              <IconButton size="small" color="error" onClick={() => onEliminar(contacto.id)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ borderBottom: '1px solid #e5e7eb' }}>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto">
          <Tab label="Datos generales" />
          <Tab label={`Domicilios${tieneDomicilio ? ' (1)' : ''}`} />
          <Tooltip title="Función en desarrollo">
            <span>
              <Tab label="Contactos adicionales" disabled />
            </span>
          </Tooltip>
          <Tab label={`Cotizaciones (${cotizacionesTotal})`} />
          <Tab label={`Facturas (${facturasTotal})`} />
        </Tabs>
      </Box>

      <Box sx={{ p: 2.5, overflowY: 'auto', flex: 1 }}>
        {tab === 0 && (
          <Stack spacing={2.5}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
              {limiteCredito ? (
                <StatCard icon={<CreditCardOutlinedIcon />} label="Línea de crédito" value={limiteCredito} />
              ) : null}
              {diasCredito ? (
                <StatCard icon={<CalendarMonthOutlinedIcon />} label="Días de crédito" value={diasCredito} />
              ) : null}
              <StatCard icon={<DescriptionOutlinedIcon />} label="Cotizaciones" value={String(cotizacionesTotal)} />
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
                <Typography variant="subtitle2" fontWeight={700} color="#374151" sx={{ mb: 0.5, letterSpacing: 0.4 }}>
                  INFORMACIÓN FISCAL
                </Typography>
                <InfoRow label="Razón social" value={contacto.nombre} />
                <InfoRow label="RFC" value={contacto.rfc || datos_fiscales?.rfc} />
                <InfoRow label="Régimen fiscal" value={datos_fiscales?.regimen_fiscal} />
                <InfoRow label="Tipo de contacto" value={contacto.tipo_contacto} />
                <InfoRow label="Clasificación" value={contacto.clasificacion_descripcion || contacto.clasificacion} />
              </Box>

              <Box>
                <Typography variant="subtitle2" fontWeight={700} color="#374151" sx={{ mb: 0.5, letterSpacing: 0.4 }}>
                  SEGUIMIENTO COMERCIAL
                </Typography>
                <InfoRow label="Vendedor asignado" value={vendedorAsignado} />
                <InfoRow label="Origen del contacto" value={contacto.origen_contacto_descripcion || contacto.origen_contacto} />
                <InfoRow label="Activo" value={contacto.activo ? 'Sí' : 'No'} />
                <InfoRow label="Alta en sistema" value={formatDate(contacto.fecha_alta)} />
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
                <Typography variant="subtitle2" fontWeight={700} color="#374151" sx={{ mb: 0.5, letterSpacing: 0.4 }}>
                  CONTACTO PRINCIPAL
                </Typography>
                <InfoRow label="Nombre" value={contacto.nombre_contacto} />
                <InfoRow label="Teléfono" value={formatearTelefonoParaMostrar(contacto.telefono)} />
                <InfoRow label="Teléfono secundario" value={formatearTelefonoParaMostrar(contacto.telefono_secundario)} />
                <InfoRow label="Correo" value={contacto.email} />
              </Box>

              {contacto.observaciones ? (
                <Box>
                  <Typography variant="subtitle2" fontWeight={700} color="#374151" sx={{ mb: 0.5, letterSpacing: 0.4 }}>
                    OBSERVACIONES
                  </Typography>
                  <Box sx={{ border: '1px solid #e5e7eb', borderRadius: 1.5, p: 1.5, backgroundColor: '#f8fafc' }}>
                    <Typography variant="body2" color="#374151" sx={{ whiteSpace: 'pre-wrap' }}>
                      {contacto.observaciones}
                    </Typography>
                  </Box>
                </Box>
              ) : null}
            </Box>
          </Stack>
        )}

        {tab === 1 && (
          <Box>
            {tieneDomicilio ? (
              <Box sx={{ border: '1px solid #e5e7eb', borderRadius: 1.5, p: 2, maxWidth: 480 }}>
                <InfoRow label="Calle y número" value={[domicilio_principal?.calle, domicilio_principal?.numero_exterior].filter(Boolean).join(' ')} />
                <InfoRow label="Colonia" value={domicilio_principal?.colonia} />
                <InfoRow label="Ciudad" value={domicilio_principal?.ciudad} />
                <InfoRow label="Estado" value={domicilio_principal?.estado} />
                <InfoRow label="Código postal" value={domicilio_principal?.cp} />
                <InfoRow label="País" value={domicilio_principal?.pais} />
              </Box>
            ) : (
              <Typography variant="body2" color="#6b7280">
                Este contacto no tiene un domicilio registrado.
              </Typography>
            )}
          </Box>
        )}

        {tab === 2 && (
          <Typography variant="body2" color="#6b7280">
            La gestión de contactos adicionales estará disponible próximamente.
          </Typography>
        )}

        {tab === 3 && (
          <DocumentosMiniLista loading={cotizacionesLoading} documentos={cotizaciones} emptyLabel="Sin cotizaciones registradas." codigo="cotizacion" />
        )}

        {tab === 4 && (
          <DocumentosMiniLista loading={facturasLoading} documentos={facturas} emptyLabel="Sin facturas registradas." codigo="factura" />
        )}
      </Box>
    </Box>
  );
}
