import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Checkbox,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
  Icon,
} from '@mui/material';
import { compareDocumentoVisualOrder } from '../../modules/documentos/documentoVisualOrder';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import AssignmentReturnIcon from '@mui/icons-material/AssignmentReturn';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import InventoryIcon from '@mui/icons-material/Inventory';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import DescriptionIcon from '@mui/icons-material/Description';
import { useSession } from '../../session/useSession';
import type { AfectaInventario, DocumentoEmpresa, TransicionDocumento } from '../../types/documentosConfiguracion';

const AFECTA_LABELS: Record<AfectaInventario, string> = {
  none: 'No afecta inventario',
  entrada: 'Entrada',
  salida: 'Salida',
  transferencia: 'Transferencia',
};
import {
  fetchDocumentosEmpresa,
  fetchFlujoDocumentos,
  updateDocumentoEmpresa,
  updateTransicionDocumento,
} from '../../services/documentosConfiguracionService';
import { fetchWhatsappPlantillas, type WhatsappPlantillaOption } from '../../services/whatsappPlantillasService';

const TAB_DOCUMENTOS = 0;
const TAB_FLUJO = 1;

const iconMap: Record<string, React.ComponentType<any>> = {
  RequestQuote: RequestQuoteIcon,
  ShoppingCart: ShoppingCartIcon,
  LocalShipping: LocalShippingIcon,
  AssignmentReturn: AssignmentReturnIcon,
  ReceiptLong: ReceiptLongIcon,
  PlaylistAddCheck: PlaylistAddCheckIcon,
  Inventory: InventoryIcon,
  Warehouse: WarehouseIcon,
  Description: DescriptionIcon,
};

function TabPanel(props: { children: React.ReactNode; value: number; index: number }) {
  const { children, value, index } = props;
  if (value !== index) return null;
  return <Box sx={{ pt: 2 }}>{children}</Box>;
}

export default function DocumentosConfiguracionPage() {
  const { session, setSession } = useSession();
  const empresas = session.empresas ?? [];
  const defaultEmpresaId = session.empresaActivaId ?? (empresas[0]?.id ?? null);

  const [empresaId, setEmpresaId] = useState<number | null>(defaultEmpresaId);
  const [tab, setTab] = useState<number>(TAB_DOCUMENTOS);

  const [documentos, setDocumentos] = useState<DocumentoEmpresa[]>([]);
  const [loadingDocumentos, setLoadingDocumentos] = useState(false);
  const [errorDocumentos, setErrorDocumentos] = useState<string | null>(null);
  const [plantillasWhatsapp, setPlantillasWhatsapp] = useState<WhatsappPlantillaOption[]>([]);
  const [loadingPlantillasWhatsapp, setLoadingPlantillasWhatsapp] = useState(false);

  const [transiciones, setTransiciones] = useState<TransicionDocumento[]>([]);
  const [documentosFlujo, setDocumentosFlujo] = useState<DocumentoEmpresa[]>([]);
  const [loadingFlujo, setLoadingFlujo] = useState(false);
  const [errorFlujo, setErrorFlujo] = useState<string | null>(null);

  const documentosOrdenados = useMemo(
    () => [...documentos].sort(compareDocumentoVisualOrder),
    [documentos]
  );

  const documentosFlujoOrdenados = useMemo(
    () => [...documentosFlujo].sort(compareDocumentoVisualOrder),
    [documentosFlujo]
  );

  useEffect(() => {
    if (empresaId) {
      void loadDocumentos();
      void loadPlantillasWhatsapp();
      if (tab === TAB_FLUJO) {
        void loadFlujo();
      }
    }
  }, [empresaId]);

  useEffect(() => {
    if (empresaId && tab === TAB_FLUJO) {
      void loadFlujo();
    }
  }, [tab]);

  const handleEmpresaChange = (value: string) => {
    const parsed = value ? Number(value) : null;
    setEmpresaId(parsed);
    setSession({ ...session, empresaActivaId: parsed });
    setDocumentos([]);
    setTransiciones([]);
    setDocumentosFlujo([]);
    setPlantillasWhatsapp([]);
  };

  const loadDocumentos = async () => {
    if (!empresaId) return;
    setLoadingDocumentos(true);
    setErrorDocumentos(null);
    try {
      const data = await fetchDocumentosEmpresa();
      setDocumentos(data);
    } catch (err: any) {
      setErrorDocumentos(err?.message || 'No se pudieron cargar los documentos');
    } finally {
      setLoadingDocumentos(false);
    }
  };

  const loadFlujo = async () => {
    if (!empresaId) return;
    setLoadingFlujo(true);
    setErrorFlujo(null);
    try {
      const data = await fetchFlujoDocumentos();
      setDocumentosFlujo(data.documentos);
      setTransiciones(data.transiciones);
    } catch (err: any) {
      setErrorFlujo(err?.message || 'No se pudo cargar el flujo de documentos');
    } finally {
      setLoadingFlujo(false);
    }
  };

  const loadPlantillasWhatsapp = async () => {
    if (!empresaId) return;
    setLoadingPlantillasWhatsapp(true);
    try {
      const data = await fetchWhatsappPlantillas();
      setPlantillasWhatsapp(data.filter((plantilla) => plantilla.activa));
    } catch (err: any) {
      setErrorDocumentos(err?.message || 'No se pudieron cargar las plantillas de WhatsApp');
    } finally {
      setLoadingPlantillasWhatsapp(false);
    }
  };

  const handleToggleDocumento = async (doc: DocumentoEmpresa, nextValue: boolean) => {
    setDocumentos((prev) => prev.map((d) => (d.id === doc.id ? { ...d, habilitado: nextValue } : d)));
    try {
      await updateDocumentoEmpresa(doc.id, { activo: nextValue });
      if (tab === TAB_FLUJO) {
        await loadFlujo();
      }
    } catch (err: any) {
      setDocumentos((prev) => prev.map((d) => (d.id === doc.id ? { ...d, habilitado: doc.habilitado } : d)));
      setErrorDocumentos(err?.message || 'No se pudo actualizar el documento');
    }
  };

  const handleWhatsappPlantillaChange = async (doc: DocumentoEmpresa, value: number | '') => {
    const nextPlantillaId = value === '' ? null : value;
    const previousPlantillaId = doc.whatsapp_plantilla_default_id;

    setDocumentos((prev) =>
      prev.map((d) => (d.id === doc.id ? { ...d, whatsapp_plantilla_default_id: nextPlantillaId } : d))
    );

    try {
      await updateDocumentoEmpresa(doc.id, {
        activo: Boolean(doc.habilitado),
        whatsapp_plantilla_default_id: nextPlantillaId,
      });
    } catch (err: any) {
      setDocumentos((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, whatsapp_plantilla_default_id: previousPlantillaId } : d))
      );
      setErrorDocumentos(err?.message || 'No se pudo actualizar la plantilla de WhatsApp');
    }
  };

  const handleAfectaInventarioChange = async (doc: DocumentoEmpresa, value: AfectaInventario | null) => {
    const previous = doc.afecta_inventario;
    setDocumentos((prev) => prev.map((d) => (d.id === doc.id ? { ...d, afecta_inventario: value } : d)));
    try {
      await updateDocumentoEmpresa(doc.id, {
        activo: Boolean(doc.habilitado),
        afecta_inventario: value,
        afecta_reservado: doc.afecta_reservado,
      });
    } catch (err: any) {
      setDocumentos((prev) => prev.map((d) => (d.id === doc.id ? { ...d, afecta_inventario: previous } : d)));
      setErrorDocumentos(err?.message || 'No se pudo actualizar afecta_inventario');
    }
  };

  const handleAfectaReservadoChange = async (doc: DocumentoEmpresa, value: boolean) => {
    const previous = doc.afecta_reservado;
    setDocumentos((prev) => prev.map((d) => (d.id === doc.id ? { ...d, afecta_reservado: value } : d)));
    try {
      await updateDocumentoEmpresa(doc.id, {
        activo: Boolean(doc.habilitado),
        afecta_inventario: doc.afecta_inventario,
        afecta_reservado: value,
      });
    } catch (err: any) {
      setDocumentos((prev) => prev.map((d) => (d.id === doc.id ? { ...d, afecta_reservado: previous } : d)));
      setErrorDocumentos(err?.message || 'No se pudo actualizar afecta_reservado');
    }
  };

  const plantillaDisponiblePorId = useMemo(() => {
    return new Set(plantillasWhatsapp.map((plantilla) => plantilla.id));
  }, [plantillasWhatsapp]);

  const isTransicionActiva = (origenId: number, destinoId: number) =>
    transiciones.some(
      (t) =>
        t.tipo_documento_origen_id === origenId &&
        t.tipo_documento_destino_id === destinoId &&
        t.activo === true
    );

  const handleToggleTransicion = async (origenId: number, destinoId: number, nextValue: boolean) => {
    const previous = transiciones;

    setTransiciones((prev) => {
      const existing = prev.find(
        (t) => t.tipo_documento_origen_id === origenId && t.tipo_documento_destino_id === destinoId
      );
      if (existing) {
        return prev.map((t) =>
          t.tipo_documento_origen_id === origenId && t.tipo_documento_destino_id === destinoId
            ? { ...t, activo: nextValue }
            : t
        );
      }
      return [...prev, { tipo_documento_origen_id: origenId, tipo_documento_destino_id: destinoId, activo: nextValue }];
    });

    try {
      await updateTransicionDocumento(origenId, destinoId, nextValue);
    } catch (err: any) {
      setTransiciones(previous);
      setErrorFlujo(err?.message || 'No se pudo actualizar la transición');
    }
  };

  const renderTablaDocumentos = () => (
    <TableContainer sx={{ border: '1px solid #e5e7eb', borderRadius: 1, backgroundColor: '#fff' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell align="center" sx={{ width: 80 }}>
              Activo
            </TableCell>
            <TableCell sx={{ width: 48 }}>Icono</TableCell>
            <TableCell>Nombre del documento</TableCell>
            <TableCell sx={{ minWidth: 180 }}>Afecta inventario</TableCell>
            <TableCell align="center" sx={{ width: 100 }}>Reservado</TableCell>
            <TableCell sx={{ minWidth: 260 }}>Plantilla envío por WhatsApp</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {documentosOrdenados.map((doc) => (
            <TableRow key={doc.id} hover>
              <TableCell align="center">
                <Checkbox
                  checked={Boolean(doc.habilitado)}
                  onChange={(e) => handleToggleDocumento(doc, e.target.checked)}
                  color="primary"
                  disabled={loadingDocumentos}
                />
              </TableCell>
              <TableCell>
                <Stack direction="row" spacing={1} alignItems="center">
                  {(() => {
                    const IconComponent = doc.icono ? iconMap[doc.icono] : null;
                    if (IconComponent) return <IconComponent fontSize="small" color="action" />;
                    return <DescriptionIcon fontSize="small" color="disabled" />;
                  })()}
                </Stack>
              </TableCell>
              <TableCell>
                <Typography variant="subtitle2" fontWeight={600} color="#1d2f68">
                  {doc.nombre}
                </Typography>
                <Typography variant="body2" color="#6b7280">
                  Código: {doc.codigo}
                </Typography>
              </TableCell>
              <TableCell>
                <FormControl fullWidth size="small">
                  <Select
                    value={doc.afecta_inventario ?? ''}
                    displayEmpty
                    disabled={loadingDocumentos}
                    onChange={(e) => {
                      const raw = e.target.value as string;
                      handleAfectaInventarioChange(doc, raw === '' ? null : (raw as AfectaInventario));
                    }}
                    renderValue={(selected) => {
                      const sel = selected as string;
                      if (sel === '') {
                        const sistemaLabel = doc.afecta_inventario_sistema
                          ? AFECTA_LABELS[doc.afecta_inventario_sistema]
                          : 'No afecta inventario';
                        return (
                          <Typography variant="body2" color="#6b7280" component="span">
                            Sistema: {sistemaLabel}
                          </Typography>
                        );
                      }
                      return AFECTA_LABELS[sel as AfectaInventario] ?? sel;
                    }}
                  >
                    <MenuItem value="">
                      <em style={{ color: '#6b7280' }}>
                        Sistema:{' '}
                        {doc.afecta_inventario_sistema
                          ? AFECTA_LABELS[doc.afecta_inventario_sistema]
                          : 'No afecta inventario'}
                      </em>
                    </MenuItem>
                    <MenuItem value="none">No afecta inventario</MenuItem>
                    <MenuItem value="entrada">Entrada</MenuItem>
                    <MenuItem value="salida">Salida</MenuItem>
                    <MenuItem value="transferencia">Transferencia</MenuItem>
                  </Select>
                </FormControl>
              </TableCell>
              <TableCell align="center">
                <Checkbox
                  checked={Boolean(doc.afecta_reservado)}
                  onChange={(e) => handleAfectaReservadoChange(doc, e.target.checked)}
                  color="primary"
                  disabled={loadingDocumentos}
                />
              </TableCell>
              <TableCell>
                <FormControl fullWidth size="small">
                  <InputLabel id={`whatsapp-plantilla-${doc.id}`} shrink>
                    Opcional
                  </InputLabel>
                  <Select
                    labelId={`whatsapp-plantilla-${doc.id}`}
                    value={
                      doc.whatsapp_plantilla_default_id && plantillaDisponiblePorId.has(doc.whatsapp_plantilla_default_id)
                        ? doc.whatsapp_plantilla_default_id
                        : ''
                    }
                    label="Opcional"
                    disabled={loadingDocumentos || loadingPlantillasWhatsapp}
                    onChange={(event) => handleWhatsappPlantillaChange(doc, event.target.value as number | '')}
                    displayEmpty
                    renderValue={(selected) => {
                      if (!selected) {
                        return <em style={{ color: '#6b7280' }}>Sin plantilla</em>;
                      }

                      const plantilla = plantillasWhatsapp.find((item) => item.id === selected);
                      return plantilla?.nombre_interno ?? String(selected);
                    }}
                  >
                    <MenuItem value="">
                      <em>Sin plantilla</em>
                    </MenuItem>
                    {plantillasWhatsapp.map((plantilla) => (
                      <MenuItem key={plantilla.id} value={plantilla.id}>
                        {plantilla.nombre_interno}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </TableCell>
            </TableRow>
          ))}

          {documentosOrdenados.length === 0 && !loadingDocumentos && (
            <TableRow>
              <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                <Typography variant="body2" color="#6b7280">
                  No se encontraron tipos de documento activos en el catálogo.
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const renderFlujo = () => {
    if (loadingFlujo) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      );
    }

    if (documentosFlujoOrdenados.length === 0) {
      return (
        <Alert severity="info">
          Activa al menos un documento en la pestaña "Documentos habilitados" para definir el flujo.
        </Alert>
      );
    }

    return (
      <TableContainer sx={{ border: '1px solid #e5e7eb', borderRadius: 1, backgroundColor: '#fff' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Origen / Destino</TableCell>
              {documentosFlujoOrdenados.map((doc) => (
                <TableCell key={doc.id} align="center">
                  <Typography variant="subtitle2" color="#1d2f68" fontWeight={700}>
                    {doc.nombre}
                  </Typography>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {documentosFlujoOrdenados.map((origen) => (
              <TableRow key={origen.id} hover>
                <TableCell>
                  <Typography variant="subtitle2" fontWeight={700} color="#1d2f68">
                    {origen.nombre}
                  </Typography>
                </TableCell>
                {documentosFlujoOrdenados.map((destino) => {
                  if (origen.id === destino.id) {
                    return (
                      <TableCell key={`${origen.id}-${destino.id}`} align="center" sx={{ color: '#9ca3af' }}>
                        —
                      </TableCell>
                    );
                  }

                  const checked = isTransicionActiva(origen.id, destino.id);
                  return (
                    <TableCell key={`${origen.id}-${destino.id}`} align="center">
                      <Checkbox
                        checked={checked}
                        onChange={(e) => handleToggleTransicion(origen.id, destino.id, e.target.checked)}
                        color="primary"
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2} flexWrap="wrap">
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1d2f68">
            Configuración de documentos
          </Typography>
          <Typography variant="body2" color="#4b5563">
            Habilita los tipos de documento por empresa y define las transiciones permitidas.
          </Typography>
        </Box>

        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="empresa-select-label">Empresa</InputLabel>
          <Select
            labelId="empresa-select-label"
            value={empresaId ? String(empresaId) : ''}
            label="Empresa"
            onChange={(e) => handleEmpresaChange(e.target.value as string)}
          >
            {empresas.map((emp) => (
              <MenuItem key={emp.id} value={String(emp.id)}>
                {emp.nombre}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        textColor="primary"
        indicatorColor="primary"
        sx={{ borderBottom: '1px solid #e5e7eb' }}
      >
        <Tab label="Documentos habilitados" value={TAB_DOCUMENTOS} />
        <Tab label="Flujo de documentos" value={TAB_FLUJO} />
      </Tabs>

      {errorDocumentos && (
        <Alert severity="error" onClose={() => setErrorDocumentos(null)}>
          {errorDocumentos}
        </Alert>
      )}

      <TabPanel value={tab} index={TAB_DOCUMENTOS}>
        {loadingDocumentos ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          renderTablaDocumentos()
        )}
      </TabPanel>

      <TabPanel value={tab} index={TAB_FLUJO}>
        {errorFlujo && (
          <Alert severity="error" onClose={() => setErrorFlujo(null)} sx={{ mb: 2 }}>
            {errorFlujo}
          </Alert>
        )}
        {renderFlujo()}
      </TabPanel>
    </Box>
  );
}