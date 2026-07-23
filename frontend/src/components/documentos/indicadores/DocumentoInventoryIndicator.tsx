import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import SettingsBackupRestoreOutlinedIcon from '@mui/icons-material/SettingsBackupRestoreOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { Stack, Typography } from '@mui/material';
import { StatusIndicator, StatusNotApplicable } from '../../status';
import type { DocumentoInventoryIndicatorModel } from './documentosIndicators.types';

const TYPE_LABELS = {
  entrada: 'Entrada',
  salida: 'Salida',
  transferencia: 'Transferencia',
  none: 'No aplica',
} as const;

export type DocumentoInventoryIndicatorProps = DocumentoInventoryIndicatorModel;

export default function DocumentoInventoryIndicator(props: DocumentoInventoryIndicatorProps) {
  if (props.status === 'not_applicable') {
    return <StatusNotApplicable label="Inventario no aplica" />;
  }
  if (props.status === 'will_apply_on_issue') {
    return (
      <StatusIndicator
        icon={Inventory2OutlinedIcon}
        tone="neutral"
        label="Afectará inventario al emitir"
        ariaLabel="Inventario pendiente de aplicación al emitir el documento"
        tooltip="Afectará inventario al emitir"
      />
    );
  }

  const config = props.status === 'applied'
    ? { icon: Inventory2OutlinedIcon, tone: 'success' as const, label: 'Inventario afectado' }
    : props.status === 'reversed'
      ? { icon: SettingsBackupRestoreOutlinedIcon, tone: 'neutral' as const, label: 'Afectación de inventario revertida por cancelación' }
      : props.status === 'warning'
        ? { icon: Inventory2OutlinedIcon, tone: 'warning' as const, label: 'No se encontró movimiento de inventario' }
        : { icon: WarningAmberOutlinedIcon, tone: 'warning' as const, label: 'Inconsistencia en afectación de inventario' };

  return (
    <StatusIndicator
      icon={config.icon}
      tone={config.tone}
      label={config.label}
      ariaLabel={config.label}
      tooltip={config.label}
      detail={(
        <Stack spacing={0.5}>
          <Typography variant="body2"><strong>Estado:</strong> {config.label}</Typography>
          <Typography variant="body2"><strong>Tipo de afectación:</strong> {TYPE_LABELS[props.type ?? 'none']}</Typography>
          <Typography variant="body2"><strong>Movimiento original:</strong> {props.originalMovementId ?? 'No disponible'}</Typography>
          <Typography variant="body2"><strong>Fecha original:</strong> {props.originalMovementDate || 'No disponible'}</Typography>
          <Typography variant="body2"><strong>Partidas afectadas:</strong> {props.movementItemsCount ?? 0}</Typography>
          {props.status === 'reversed' || props.reversalMovementId != null ? (
            <>
              <Typography variant="body2"><strong>Movimiento de reversión:</strong> {props.reversalMovementId ?? 'No disponible'}</Typography>
              <Typography variant="body2"><strong>Fecha de reversión:</strong> {props.reversalMovementDate || 'No disponible'}</Typography>
            </>
          ) : null}
          {props.originalMovementsCount != null ? (
            <Typography variant="body2"><strong>Movimientos originales encontrados:</strong> {props.originalMovementsCount}</Typography>
          ) : null}
          {props.reversalMovementsCount != null ? (
            <Typography variant="body2"><strong>Reversiones encontradas:</strong> {props.reversalMovementsCount}</Typography>
          ) : null}
          {props.reason ? <Typography variant="body2">{props.reason}</Typography> : null}
        </Stack>
      )}
    />
  );
}
