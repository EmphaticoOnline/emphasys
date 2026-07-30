import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import GppMaybeOutlinedIcon from '@mui/icons-material/GppMaybeOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import PendingActionsOutlinedIcon from '@mui/icons-material/PendingActionsOutlined';
import SyncProblemOutlinedIcon from '@mui/icons-material/SyncProblemOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import { Stack, Typography } from '@mui/material';
import { StatusIndicator, StatusNotApplicable } from '../../status';
import type { DocumentoCfdiIndicatorModel } from './documentosIndicators.types';

export type DocumentoCfdiIndicatorProps = DocumentoCfdiIndicatorModel;

export default function DocumentoCfdiIndicator(props: DocumentoCfdiIndicatorProps) {
  if (props.status === 'not_applicable') {
    return <StatusNotApplicable label="CFDI no aplica" />;
  }

  const config = props.status === 'cancellation_reconciliation'
    ? { icon: SyncProblemOutlinedIcon, tone: 'error' as const, label: 'Cancelación requiere conciliación' }
    : props.status === 'cancellation_requested'
      ? { icon: PendingActionsOutlinedIcon, tone: 'warning' as const, label: 'Cancelación solicitada' }
    : props.status === 'cancellation_pending'
      ? { icon: PendingActionsOutlinedIcon, tone: 'warning' as const, label: 'Cancelación pendiente' }
    : props.status === 'cancellation_rejected'
      ? { icon: ReportProblemOutlinedIcon, tone: 'error' as const, label: 'Cancelación rechazada' }
    : props.status === 'cancellation_error'
      ? { icon: ErrorOutlineOutlinedIcon, tone: 'error' as const, label: 'Error en cancelación' }
    : props.status === 'stamped'
    ? { icon: VerifiedOutlinedIcon, tone: 'info' as const, label: 'CFDI timbrado' }
    : props.status === 'not_stamped'
      ? { icon: GppMaybeOutlinedIcon, tone: 'neutral' as const, label: 'CFDI sin timbrar' }
      : props.status === 'cancelled'
        ? { icon: CancelOutlinedIcon, tone: 'error' as const, label: 'CFDI cancelado' }
        : { icon: HelpOutlineOutlinedIcon, tone: 'warning' as const, label: 'Estado CFDI inconsistente o desconocido' };

  return (
    <StatusIndicator
      icon={config.icon}
      tone={config.tone}
      label={config.label}
      ariaLabel={config.label}
      detail={(
        <Stack spacing={0.5}>
          <Typography variant="body2"><strong>Estado CFDI:</strong> {props.status === 'cancelled' ? 'Cancelado' : props.uuid ? 'Timbrado' : 'Sin timbrar'}</Typography>
          <Typography variant="body2"><strong>Estado de cancelación:</strong> {
            props.cancellationStatus
              ? props.cancellationStatus.replaceAll('_', ' ').replace(/^./, (value) => value.toUpperCase())
              : 'No solicitada'
          }</Typography>
          <Typography variant="body2" sx={{ userSelect: 'text', overflowWrap: 'anywhere' }}>
            <strong>UUID:</strong> {props.uuid || 'No disponible'}
          </Typography>
          <Typography variant="body2"><strong>Fecha de timbrado:</strong> {props.stampedAt || 'No disponible'}</Typography>
          <Typography variant="body2"><strong>Estado SAT:</strong> {props.satStatus || 'No disponible'}</Typography>
          <Typography variant="body2"><strong>Fecha de cancelación:</strong> {props.cancelledAt || 'No disponible'}</Typography>
          {props.cancellationRequestedAt ? <Typography variant="body2"><strong>Fecha de solicitud:</strong> {props.cancellationRequestedAt}</Typography> : null}
          {props.cancellationAttemptId ? <Typography variant="body2"><strong>Intento:</strong> {props.cancellationAttemptId}</Typography> : null}
          {['cancellation_requested', 'cancellation_pending', 'cancellation_reconciliation'].includes(props.status) ? (
            <Typography variant="body2">
              La factura permanece timbrada hasta que el PAC o el SAT confirmen la cancelación.
            </Typography>
          ) : null}
        </Stack>
      )}
    />
  );
}
