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
import type { DocumentoEmpresa, TransicionDocumento } from '../../types/documentosConfiguracion';
import {
  fetchDocumentosEmpresa,
  fetchFlujoDocumentos,
  updateDocumentoEmpresa,
  updateTransicionDocumento,
} from '../../services/documentosConfiguracionService';

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

  const [transiciones, setTransiciones] = useState<TransicionDocumento[]>([]);
  const [documentosFlujo, setDocumentosFlujo] = useState<DocumentoEmpresa[]>([]);
  const [loadingFlujo, setLoadingFlujo] = useState(false);
  const [errorFlujo, setErrorFlujo] = useState<string | null>(null);

  const documentosOrdenados = useMemo(
    () => [...documentos].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre)),
    [documentos]
  );

  const documentosFlujoOrdenados = useMemo(
    () => [...documentosFlujo].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre)),
    [documentosFlujo]
  );

  useEffect(() => {
    if (empresaId) {
      void loadDocumentos();
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

  const handleToggleDocumento = async (doc: DocumentoEmpresa, nextValue: boolean) => {
    setDocumentos((prev) => prev.map((d) => (d.id === doc.id ? { ...d, habilitado: nextValue } : d)));
    try {
      await updateDocumentoEmpresa(doc.id, nextValue);
      if (tab === TAB_FLUJO) {
        await loadFlujo();
      }
    } catch (err: any) {
      setDocumentos((prev) => prev.map((d) => (d.id === doc.id ? { ...d, habilitado: doc.habilitado } : d)));
      setErrorDocumentos(err?.message || 'No se pudo actualizar el documento');
    }
  };

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
            <TableCell align="center" sx={{ width: 120 }}>
              Activo
            </TableCell>
            <TableCell sx={{ width: 120 }}>Icono</TableCell>
            <TableCell>Nombre del documento</TableCell>
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
            </TableRow>
          ))}

          {documentosOrdenados.length === 0 && !loadingDocumentos && (
            <TableRow>
              <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
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