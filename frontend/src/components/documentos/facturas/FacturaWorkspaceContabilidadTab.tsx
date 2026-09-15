import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { DocumentoAccountingIndicatorModel } from '../indicadores/documentosIndicators.types';
import type { DocumentoPolizaRelacionadaDto } from '../../../services/facturaVentaContabilizacionService';
import { fetchPoliza } from '../../../services/polizasService';
import type { PolizaConMovimientos } from '../../../types/polizas';
import { bodyCellSx, EmptyState, formatDateShort, headerCellSx } from '../DocumentoDetalleContent';

const RELATION_LABELS: Record<DocumentoPolizaRelacionadaDto['relacion'], string> = {
  emision: 'Emisión',
  cancelacion: 'Cancelación',
  reversa: 'Reversa',
  ajuste: 'Ajuste',
  otra: 'Otra',
};

const STATUS_LABELS: Record<string, string> = {
  accounted: 'Contabilizada',
  pending: 'Pendiente de contabilizar',
  not_accountable: 'No contabilizable',
  unknown: 'Estado no disponible',
};

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

type Props = {
  accounting: DocumentoAccountingIndicatorModel | undefined;
};

export default function FacturaWorkspaceContabilidadTab({ accounting }: Props) {
  const policies = accounting?.policies ?? [];
  const [details, setDetails] = useState<Record<number, PolizaConMovimientos | null>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const policyIdsKey = policies.map((policy) => policy.polizaId).filter((id) => Number(id) > 0).join(',');
  const policyIds = useMemo(
    () => [...new Set(policyIdsKey.split(',').map((id) => Number(id)).filter((id) => id > 0))],
    [policyIdsKey]
  );

  useEffect(() => {
    if (policyIds.length === 0) {
      setDetails({});
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.allSettled(policyIds.map((id) => fetchPoliza(id)))
      .then((results) => {
        if (cancelled) return;
        const next: Record<number, PolizaConMovimientos | null> = {};
        const failures: string[] = [];
        results.forEach((result, index) => {
          const id = policyIds[index];
          if (result.status === 'fulfilled') next[id] = result.value;
          else {
            next[id] = null;
            failures.push(`Póliza ${id}`);
          }
        });
        setDetails(next);
        setError(failures.length ? `No se pudieron cargar los movimientos de: ${failures.join(', ')}.` : null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [policyIds]);

  if (!accounting || accounting.status === 'unknown') {
    return <EmptyState mensaje={accounting?.reason || 'Estado contable no disponible.'} />;
  }

  if (accounting.status === 'pending' && policies.length === 0) {
    return (
      <Stack spacing={1.5}>
        <Typography variant="body2" fontWeight={700}>{STATUS_LABELS.pending}</Typography>
        {accounting.reason ? <Typography variant="body2" color="text.secondary">{accounting.reason}</Typography> : null}
        <EmptyState mensaje="Esta factura aún no tiene pólizas relacionadas." />
      </Stack>
    );
  }

  if (accounting.status === 'not_accountable' && policies.length === 0) {
    return (
      <Stack spacing={1.5}>
        <Typography variant="body2" fontWeight={700}>{STATUS_LABELS.not_accountable}</Typography>
        <EmptyState mensaje={accounting.reason || 'Esta factura no es contabilizable.'} />
      </Stack>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="subtitle2" fontWeight={800}>{STATUS_LABELS[accounting.status] || STATUS_LABELS.unknown}</Typography>
        {accounting.reason ? (
          <Typography variant="body2" color="text.secondary">{accounting.reason}</Typography>
        ) : null}
      </Stack>

      {policies.map((policy) => {
        const loaded = details[policy.polizaId];
        const movimientos = loaded?.movimientos ?? [];
        return (
          <Box key={`${policy.contabilizacionId}-${policy.polizaId}`}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
              <Typography variant="subtitle2" fontWeight={800}>
                Póliza {policy.numero ?? `#${policy.polizaId}`}
              </Typography>
              <Chip size="small" label={RELATION_LABELS[policy.relacion]} sx={{ height: 20, fontWeight: 700 }} />
              <Chip
                size="small"
                label={policy.estatus || loaded?.encabezado.estatus || 'Sin estatus'}
                sx={{ height: 20 }}
              />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {policy.tipoPolizaNombre || policy.tipoPolizaIdentificador || 'Tipo no disponible'}
              {' · '}
              {formatDateShort(policy.fecha || loaded?.encabezado.fecha)}
            </Typography>

            {loading && !loaded ? (
              <Stack alignItems="center" py={2}><CircularProgress size={22} /></Stack>
            ) : movimientos.length > 0 ? (
              <TableContainer sx={{ border: '1px solid #e5e7eb', borderRadius: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={headerCellSx}>Cuenta</TableCell>
                      <TableCell sx={headerCellSx}>Concepto</TableCell>
                      <TableCell align="right" sx={headerCellSx}>Cargo</TableCell>
                      <TableCell align="right" sx={headerCellSx}>Abono</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {movimientos.map((mov) => (
                      <TableRow key={mov.id}>
                        <TableCell sx={bodyCellSx}>
                          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{mov.cuenta}</Typography>
                          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{mov.cuenta_descripcion}</Typography>
                        </TableCell>
                        <TableCell sx={bodyCellSx}>{mov.concepto_texto || mov.concepto_descripcion || '—'}</TableCell>
                        <TableCell align="right" sx={{ ...bodyCellSx, fontVariantNumeric: 'tabular-nums' }}>
                          {Number(mov.cargo) > 0 ? money.format(Number(mov.cargo)) : '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ ...bodyCellSx, fontVariantNumeric: 'tabular-nums' }}>
                          {Number(mov.abono) > 0 ? money.format(Number(mov.abono)) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Encabezado de póliza disponible. Los movimientos no se pudieron cargar en esta vista.
              </Typography>
            )}
          </Box>
        );
      })}

      {error ? <Alert severity="warning">{error}</Alert> : null}
    </Stack>
  );
}
