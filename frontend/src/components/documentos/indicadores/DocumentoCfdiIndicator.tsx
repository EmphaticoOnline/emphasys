import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import GppMaybeOutlinedIcon from '@mui/icons-material/GppMaybeOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import { Stack, Typography } from '@mui/material';
import { StatusIndicator, StatusNotApplicable } from '../../status';
import type { DocumentoCfdiIndicatorModel } from './documentosIndicators.types';

export type DocumentoCfdiIndicatorProps = DocumentoCfdiIndicatorModel;

export default function DocumentoCfdiIndicator(props: DocumentoCfdiIndicatorProps) {
  if (props.status === 'not_applicable') {
    return <StatusNotApplicable label="CFDI no aplica" />;
  }

  const config = props.status === 'stamped'
    ? { icon: VerifiedOutlinedIcon, tone: 'info' as const, label: 'CFDI timbrado' }
    : props.status === 'not_stamped'
      ? { icon: GppMaybeOutlinedIcon, tone: 'neutral' as const, label: 'CFDI sin timbrar' }
      : props.status === 'cancelled'
        ? { icon: CancelOutlinedIcon, tone: 'error' as const, label: 'CFDI cancelado ante SAT' }
        : { icon: HelpOutlineOutlinedIcon, tone: 'warning' as const, label: 'Estado CFDI inconsistente o desconocido' };

  return (
    <StatusIndicator
      icon={config.icon}
      tone={config.tone}
      label={config.label}
      ariaLabel={config.label}
      detail={(
        <Stack spacing={0.5}>
          <Typography variant="body2"><strong>Estado:</strong> {config.label}</Typography>
          <Typography variant="body2" sx={{ userSelect: 'text', overflowWrap: 'anywhere' }}>
            <strong>UUID:</strong> {props.uuid || 'No disponible'}
          </Typography>
          <Typography variant="body2"><strong>Fecha de timbrado:</strong> {props.stampedAt || 'No disponible'}</Typography>
          <Typography variant="body2"><strong>Estado SAT:</strong> {props.satStatus || 'No disponible'}</Typography>
          <Typography variant="body2"><strong>Fecha de cancelación:</strong> {props.cancelledAt || 'No disponible'}</Typography>
        </Stack>
      )}
    />
  );
}
