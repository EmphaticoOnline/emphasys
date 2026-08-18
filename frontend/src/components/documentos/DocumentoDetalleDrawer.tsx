import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, CircularProgress, Drawer, IconButton, Stack, Tab, Tabs, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { TipoDocumento } from '../../types/documentos.types';
import {
  etiquetaTipoDocumento,
  folioDe,
  useDocumentoDetalleData,
  ResumenTab,
  PartidasTab,
  PagosTab,
  NotasCreditoTab,
  RelacionadosTab,
  InventarioTab,
} from './DocumentoDetalleContent';

function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
  if (value !== index) return null;
  return (
    <Box role="tabpanel" sx={{ pt: 2 }}>
      {children}
    </Box>
  );
}

interface DocumentoDetalleDrawerProps {
  open: boolean;
  documentoId: number | null;
  tipoDocumento: TipoDocumento;
  onClose: () => void;
  onReconciled?: () => void | Promise<void>;
}

export default function DocumentoDetalleDrawer({ open, documentoId, tipoDocumento, onClose, onReconciled }: DocumentoDetalleDrawerProps) {
  const [tab, setTab] = useState(0);

  const { data, loading, error, reconciling, reconciliationMessage, handleReconcile } = useDocumentoDetalleData(
    documentoId,
    tipoDocumento,
    open
  );

  useEffect(() => {
    if (!open) setTab(0);
  }, [open]);

  const formatter = useMemo(
    () => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }),
    []
  );

  const documento = data?.documento as any;
  const folio = documento ? folioDe(documento.serie, documento.numero) : '—';
  const nombreContacto = documento?.cliente_nombre || documento?.nombre_receptor || '—';

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{ '& .MuiDrawer-paper': { width: { xs: '100%', md: 820 }, maxWidth: '100%' } }}
    >
      <Box sx={{ p: 3, height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h6" fontWeight={700} color="#1d2f68">
              {etiquetaTipoDocumento(tipoDocumento)} {folio}
            </Typography>
            {documento && (
              <Typography variant="body2" color="text.secondary">
                {nombreContacto}
              </Typography>
            )}
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>

        {loading && (
          <Stack alignItems="center" py={4} spacing={1}>
            <CircularProgress size={32} />
            <Typography variant="body2">Cargando detalle del documento…</Typography>
          </Stack>
        )}

        {!loading && error && <Alert severity="error">{error}</Alert>}

        {!loading && !error && data && (
          <>
            <Tabs
              value={tab}
              onChange={(_e, value) => setTab(value)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ borderBottom: '1px solid #e5e7eb', minHeight: 36 }}
            >
              <Tab label="Resumen" sx={{ minHeight: 36 }} />
              <Tab label="Partidas" sx={{ minHeight: 36 }} />
              <Tab label="Pagos" sx={{ minHeight: 36 }} />
              <Tab label="Notas de crédito" sx={{ minHeight: 36 }} />
              <Tab label="Relacionados" sx={{ minHeight: 36 }} />
              <Tab label="Inventario" sx={{ minHeight: 36 }} />
            </Tabs>

            <TabPanel value={tab} index={0}>
              <ResumenTab
                documento={documento}
                formatter={formatter}
                tipoDocumento={tipoDocumento}
                folio={folio}
                reconciling={reconciling}
                reconciliationMessage={reconciliationMessage}
                onReconcile={async () => {
                  const result = await handleReconcile();
                  if (result) await onReconciled?.();
                }}
              />
            </TabPanel>
            <TabPanel value={tab} index={1}>
              <PartidasTab partidas={data.partidas} formatter={formatter} />
            </TabPanel>
            <TabPanel value={tab} index={2}>
              <PagosTab pagos={data.pagos} formatter={formatter} />
            </TabPanel>
            <TabPanel value={tab} index={3}>
              <NotasCreditoTab notasCredito={data.notasCredito} formatter={formatter} />
            </TabPanel>
            <TabPanel value={tab} index={4}>
              <RelacionadosTab documentosRelacionados={data.documentosRelacionados} formatter={formatter} />
            </TabPanel>
            <TabPanel value={tab} index={5}>
              <InventarioTab movimientos={data.movimientosInventario} />
            </TabPanel>
          </>
        )}
      </Box>
    </Drawer>
  );
}
