import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import { Box, Divider, Stack, Typography } from '@mui/material';
import { StatusIndicator } from '../../status';
import type { DocumentoPolizaRelacionadaDto } from '../../../services/facturaVentaContabilizacionService';
import type { DocumentoAccountingIndicatorModel } from './documentosIndicators.types';

const RELATION_LABELS: Record<DocumentoPolizaRelacionadaDto['relacion'], string> = {
  emision: 'Emisión',
  cancelacion: 'Cancelación',
  reversa: 'Reversa',
  ajuste: 'Ajuste',
  otra: 'Otra',
};

function policyNumber(policy?: DocumentoPolizaRelacionadaDto) {
  if (!policy || policy.numero == null || String(policy.numero).trim() === '') return null;
  return String(policy.numero);
}

export type DocumentoAccountingIndicatorProps = DocumentoAccountingIndicatorModel;

export default function DocumentoAccountingIndicator(props: DocumentoAccountingIndicatorProps) {
  const policies = props.policies ?? [];
  const primary = policies.find((policy) => policy.polizaId === props.primaryPolicyId)
    ?? policies.find((policy) => policy.relacion === 'emision')
    ?? policies[0];
  const number = policyNumber(primary);
  const additional = Math.max(0, policies.length - (primary ? 1 : 0));
  const shortText = number ? `${number}${additional > 0 ? ` +${additional}` : ''}` : undefined;
  const config = props.status === 'accounted'
    ? { icon: CalculateOutlinedIcon, tone: 'success' as const, label: 'Factura contabilizada' }
    : props.status === 'pending'
      ? { icon: CalculateOutlinedIcon, tone: 'warning' as const, label: 'Pendiente de contabilizar' }
      : props.status === 'not_accountable'
        ? { icon: BlockOutlinedIcon, tone: 'blocked' as const, label: 'Factura no contabilizable' }
        : { icon: HelpOutlineOutlinedIcon, tone: 'neutral' as const, label: 'Estado contable no disponible' };

  const detail = (
    <Stack spacing={1}>
      {props.reason ? <Typography variant="body2">{props.reason}</Typography> : null}
      {policies.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No hay pólizas relacionadas.</Typography>
      ) : policies.map((policy, index) => (
        <Box key={`${policy.contabilizacionId}-${policy.polizaId}`}>
          {index > 0 ? <Divider sx={{ mb: 1 }} /> : null}
          <Typography variant="body2" fontWeight={700}>{RELATION_LABELS[policy.relacion]}</Typography>
          <Typography variant="body2"><strong>Tipo:</strong> {policy.tipoPolizaNombre || policy.tipoPolizaIdentificador || 'No disponible'}</Typography>
          <Typography variant="body2"><strong>Número:</strong> {policy.numero ?? 'No disponible'}</Typography>
          <Typography variant="body2"><strong>Fecha:</strong> {policy.fecha || 'No disponible'}</Typography>
          <Typography variant="body2"><strong>Estatus:</strong> {policy.estatus || 'No disponible'}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Póliza #{policy.polizaId} · Contabilización #{policy.contabilizacionId || 'legacy'} · Evento {policy.eventoContable}
          </Typography>
        </Box>
      ))}
    </Stack>
  );

  return (
    <StatusIndicator
      icon={config.icon}
      tone={config.tone}
      label={config.label}
      ariaLabel={`${config.label}${shortText ? `, póliza ${shortText}` : ''}`}
      shortText={shortText}
      tooltip={props.reason || (shortText ? `${config.label}: ${shortText}` : config.label)}
      detail={detail}
    />
  );
}
