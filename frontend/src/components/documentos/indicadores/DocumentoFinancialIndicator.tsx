import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import DonutLargeOutlinedIcon from '@mui/icons-material/DonutLargeOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import { Stack, Typography } from '@mui/material';
import { StatusIndicator } from '../../status';
import type { DocumentoFinancialIndicatorModel } from './documentosIndicators.types';

function currency(value: number | null | undefined, code?: string | null) {
  if (value == null || !Number.isFinite(value)) return 'No disponible';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: code || 'MXN' }).format(value);
}

export type DocumentoFinancialIndicatorProps = DocumentoFinancialIndicatorModel;

export default function DocumentoFinancialIndicator(props: DocumentoFinancialIndicatorProps) {
  const config = props.status === 'paid'
    ? { icon: PaidOutlinedIcon, tone: 'success' as const, label: 'Factura liquidada' }
    : props.status === 'partial'
      ? { icon: DonutLargeOutlinedIcon, tone: 'warning' as const, label: 'Pago parcial' }
      : props.status === 'overdue'
        ? { icon: ErrorOutlineOutlinedIcon, tone: 'error' as const, label: 'Pago vencido' }
      : props.status === 'pending'
        ? { icon: ScheduleOutlinedIcon, tone: 'warning' as const, label: 'Pago pendiente' }
        : { icon: HelpOutlineOutlinedIcon, tone: 'neutral' as const, label: 'Estado financiero no disponible' };

  const shortBalance = props.showShortBalance && props.status === 'partial' && props.balance != null
    ? currency(props.balance, props.currency)
    : undefined;

  return (
    <StatusIndicator
      icon={config.icon}
      tone={config.tone}
      label={config.label}
      ariaLabel={config.label}
      shortText={shortBalance}
      detail={(
        <Stack spacing={0.5}>
          <Typography variant="body2"><strong>Estado:</strong> {config.label}</Typography>
          <Typography variant="body2"><strong>Total:</strong> {currency(props.total, props.currency)}</Typography>
          <Typography variant="body2"><strong>Pagado:</strong> {currency(props.paidAmount, props.currency)}</Typography>
          <Typography variant="body2"><strong>Saldo:</strong> {currency(props.balance, props.currency)}</Typography>
          {props.dueDate ? <Typography variant="body2"><strong>Vencimiento:</strong> {props.dueDate}</Typography> : null}
        </Stack>
      )}
    />
  );
}
