import {
  Box,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { NumericFormat } from 'react-number-format';
import type { LiquidacionConfig } from './liquidacionDocumento.copy';
import type { LiquidacionFila } from './useLiquidacionDocumento';
import { roundMoney } from './liquidacionDocumento.money';
import {
  LIQUIDACION_AMBER,
  LIQUIDACION_BORDER,
  LIQUIDACION_FIELD_BORDER,
  LIQUIDACION_LABEL,
  LIQUIDACION_NAVY,
  captureFieldSx,
  fieldLabelSx,
} from './liquidacionDocumento.styles';

type Props = {
  config: LiquidacionConfig;
  filas: LiquidacionFila[];
  aplicaciones: Record<number, number>;
  formatter: Intl.NumberFormat;
  useCards: boolean;
  onChangeAplicacion: (filaId: number, saldo: number, value: string | number | null | undefined) => void;
};

const headerCellSx = {
  backgroundColor: LIQUIDACION_NAVY,
  color: '#fff',
  fontWeight: 600,
  fontSize: 11,
  py: '5px',
  px: 1,
  borderBottom: 'none',
};

const bodyCellSx = {
  fontSize: 13,
  py: '5px',
  px: 1,
  borderBottom: `1px solid ${LIQUIDACION_BORDER}`,
  verticalAlign: 'middle',
};

function formatFecha(value: string) {
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [y, m, d] = value.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  return value;
}

function ImporteAplicar({
  value,
  onChange,
  primary,
}: {
  value: number;
  onChange: (next: string | number | null | undefined) => void;
  primary?: boolean;
}) {
  return (
    <NumericFormat
      customInput={TextField}
      size="small"
      fullWidth
      hiddenLabel
      value={value > 0 ? value : ''}
      thousandSeparator=","
      decimalSeparator="."
      decimalScale={2}
      fixedDecimalScale
      allowNegative={false}
      prefix="$"
      placeholder="$0.00"
      onValueChange={(values, sourceInfo) => {
        if (sourceInfo.source === 'event') {
          onChange(values.value);
        }
      }}
      inputProps={{ inputMode: 'decimal', style: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }}
      sx={
        primary
          ? {
              '& .MuiOutlinedInput-root': {
                height: 40,
                bgcolor: '#fff',
                backgroundColor: '#fff',
                borderRadius: '6px',
                '& fieldset': { borderColor: LIQUIDACION_NAVY },
                '&:hover': { backgroundColor: '#fff' },
                '&:hover fieldset': { borderColor: LIQUIDACION_NAVY },
                '&.Mui-focused': { backgroundColor: '#fff' },
                '&.Mui-focused fieldset': { borderColor: LIQUIDACION_NAVY, borderWidth: '1px' },
              },
              '& .MuiOutlinedInput-input': {
                py: 0,
                height: 40,
                boxSizing: 'border-box',
                fontSize: 14,
                fontWeight: 700,
                color: LIQUIDACION_NAVY,
                backgroundColor: '#fff',
              },
            }
          : captureFieldSx
      }
    />
  );
}

function RestanteTexto({
  config,
  fila,
  aplicado,
  formatter,
  alignRight,
}: {
  config: LiquidacionConfig;
  fila: LiquidacionFila;
  aplicado: number;
  formatter: Intl.NumberFormat;
  alignRight?: boolean;
}) {
  const restante = roundMoney(Math.max(0, fila.saldo - aplicado));
  const cubierta = restante <= 0.009 && aplicado > 0;
  return (
    <Typography
      sx={{
        fontSize: 12,
        fontWeight: 500,
        fontVariantNumeric: 'tabular-nums',
        textAlign: alignRight ? 'right' : 'left',
        color: cubierta ? 'success.main' : restante > 0.009 ? LIQUIDACION_AMBER : 'text.secondary',
      }}
    >
      {cubierta ? config.textos.cubierta : `Resta ${formatter.format(restante)}`}
    </Typography>
  );
}

function OrigenReadOnlyEntry({ value, positive }: { value: string; positive?: boolean }) {
  return (
    <Box
      sx={{
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        px: 1.25,
        border: `1px solid ${LIQUIDACION_FIELD_BORDER}`,
        borderRadius: '6px',
        bgcolor: '#f4f6f9',
        color: positive ? 'success.main' : LIQUIDACION_NAVY,
        fontSize: 14,
        fontWeight: positive ? 600 : 700,
        fontVariantNumeric: 'tabular-nums',
        pointerEvents: 'none',
      }}
    >
      {value}
    </Box>
  );
}

function OrigenCard({
  config,
  fila,
  aplicado,
  formatter,
  compact,
  onChangeAplicacion,
}: {
  config: LiquidacionConfig;
  fila: LiquidacionFila;
  aplicado: number;
  formatter: Intl.NumberFormat;
  compact: boolean;
  onChangeAplicacion: Props['onChangeAplicacion'];
}) {
  const restante = roundMoney(Math.max(0, fila.saldo - aplicado));
  const cubierta = restante <= 0.009 && aplicado > 0;
  const restanteValue = cubierta ? config.textos.cubierta : formatter.format(restante);

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: compact ? '1fr' : '158px minmax(0, 1fr)',
        border: `1px solid ${LIQUIDACION_BORDER}`,
        borderRadius: '8px',
        overflow: 'hidden',
        bgcolor: '#fff',
        minHeight: compact ? 0 : 78,
      }}
    >
      <Box
        sx={{
          bgcolor: LIQUIDACION_NAVY,
          color: '#fff',
          px: 1.5,
          py: { xs: 1, sm: 1.15 },
          display: 'flex',
          flexDirection: compact ? 'row' : 'column',
          justifyContent: compact ? 'space-between' : 'center',
          alignItems: compact ? 'center' : 'flex-start',
          gap: compact ? 1 : 0.7,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            {fila.folio}
          </Typography>
          <Typography
            sx={{
              mt: 0.45,
              display: 'inline-block',
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              bgcolor: 'rgba(255,255,255,0.14)',
              border: '1px solid rgba(255,255,255,0.28)',
              px: 0.7,
              py: 0.2,
              borderRadius: '3px',
            }}
          >
            {config.textos.estaFactura}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: 12, fontWeight: 500, opacity: 0.78, whiteSpace: 'nowrap' }}>
          {formatFecha(fila.fecha)}
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: compact
            ? '1fr'
            : 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)',
          columnGap: compact ? 0 : 2.25,
          rowGap: 1.1,
          alignItems: 'end',
          px: compact ? 1.25 : 2,
          py: compact ? 1.15 : 1.25,
        }}
      >
        <Box>
          <Typography sx={fieldLabelSx}>Saldo pendiente</Typography>
          <OrigenReadOnlyEntry value={formatter.format(fila.saldo)} />
        </Box>
        <Box>
          <Typography sx={fieldLabelSx}>Aplicar</Typography>
          <ImporteAplicar
            value={aplicado}
            primary
            onChange={(value) => onChangeAplicacion(fila.id, fila.saldo, value)}
          />
        </Box>
        <Box>
          <Typography sx={fieldLabelSx}>Saldo restante</Typography>
          <OrigenReadOnlyEntry value={restanteValue} positive={cubierta} />
        </Box>
      </Box>
    </Box>
  );
}

export default function LiquidacionAplicacionesList({
  config,
  filas,
  aplicaciones,
  formatter,
  useCards,
  onChangeAplicacion,
}: Props) {
  const origen = filas.filter((fila) => fila.esOrigen);
  const otras = filas.filter((fila) => !fila.esOrigen);

  return (
    <Stack spacing={1.25}>
      {origen.map((fila) => {
        const aplicado = roundMoney(Number(aplicaciones[fila.id] ?? 0));
        return (
          <Box key={fila.id}>
            <Typography sx={fieldLabelSx}>Factura origen</Typography>
            <OrigenCard
              config={config}
              fila={fila}
              aplicado={aplicado}
              formatter={formatter}
              compact={useCards}
              onChangeAplicacion={onChangeAplicacion}
            />
          </Box>
        );
      })}

      <Box>
        <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={1} sx={{ mb: 0.75 }}>
          <Typography sx={{ color: LIQUIDACION_NAVY, fontSize: 14, fontWeight: 600 }}>
            {config.textos.otrasFacturas}
          </Typography>
          <Typography sx={{ fontSize: 12, color: LIQUIDACION_LABEL }}>
            Aplicación manual. Importe &gt; 0 aplica.
          </Typography>
        </Stack>

        {useCards ? (
          <Stack spacing={1.5}>
            {otras.map((fila) => {
              const aplicado = roundMoney(Number(aplicaciones[fila.id] ?? 0));
              return (
                <Box
                  key={fila.id}
                  sx={{
                    border: `1px solid ${LIQUIDACION_BORDER}`,
                    borderRadius: 2,
                    backgroundColor: '#fff',
                    p: 1.5,
                  }}
                >
                  <Stack spacing={1.25}>
                    <Typography sx={{ fontWeight: 500, color: LIQUIDACION_NAVY, fontSize: 14 }}>
                      {fila.folio}
                    </Typography>
                    <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                      Fecha: {formatFecha(fila.fecha)}
                    </Typography>
                    <Box>
                      <Typography sx={fieldLabelSx}>Saldo pendiente</Typography>
                      <Typography sx={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: LIQUIDACION_NAVY }}>
                        {formatter.format(fila.saldo)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={fieldLabelSx}>Aplicar</Typography>
                      <ImporteAplicar
                        value={aplicado}
                        onChange={(value) => onChangeAplicacion(fila.id, fila.saldo, value)}
                      />
                    </Box>
                    <RestanteTexto config={config} fila={fila} aplicado={aplicado} formatter={formatter} />
                  </Stack>
                </Box>
              );
            })}
            {otras.length === 0 ? (
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{config.textos.vacioOtras}</Typography>
            ) : null}
          </Stack>
        ) : (
          <TableContainer sx={{ border: `1px solid ${LIQUIDACION_BORDER}`, borderRadius: 2, overflowX: 'hidden', bgcolor: '#fff' }}>
            <Table size="small" sx={{ tableLayout: 'auto', width: '100%' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ ...headerCellSx, whiteSpace: 'nowrap' }}>Factura</TableCell>
                  <TableCell sx={{ ...headerCellSx, whiteSpace: 'nowrap' }}>Fecha</TableCell>
                  <TableCell align="right" sx={{ ...headerCellSx, whiteSpace: 'nowrap' }}>Saldo pendiente</TableCell>
                  <TableCell align="right" sx={{ ...headerCellSx, width: 132 }}>Aplicar</TableCell>
                  <TableCell align="right" sx={{ ...headerCellSx, whiteSpace: 'nowrap' }}>Restante</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {otras.map((fila) => {
                  const aplicado = roundMoney(Number(aplicaciones[fila.id] ?? 0));
                  return (
                    <TableRow key={fila.id} hover>
                      <TableCell sx={{ ...bodyCellSx, whiteSpace: 'nowrap' }}>
                        <Typography sx={{ fontWeight: 600, color: LIQUIDACION_NAVY, fontSize: 13 }}>
                          {fila.folio}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ ...bodyCellSx, whiteSpace: 'nowrap', color: 'text.secondary' }}>{formatFecha(fila.fecha)}</TableCell>
                      <TableCell align="right" sx={{ ...bodyCellSx, fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: LIQUIDACION_NAVY, whiteSpace: 'nowrap' }}>
                        {formatter.format(fila.saldo)}
                      </TableCell>
                      <TableCell align="right" sx={{ ...bodyCellSx, width: 132 }}>
                        <Box sx={{ width: 120, ml: 'auto' }}>
                          <ImporteAplicar
                            value={aplicado}
                            onChange={(value) => onChangeAplicacion(fila.id, fila.saldo, value)}
                          />
                        </Box>
                      </TableCell>
                      <TableCell align="right" sx={{ ...bodyCellSx, whiteSpace: 'nowrap' }}>
                        <RestanteTexto config={config} fila={fila} aplicado={aplicado} formatter={formatter} alignRight />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {otras.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ py: 1.1, px: 1.25, color: 'text.secondary', fontSize: 13 }}>
                      {config.textos.vacioOtras}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Stack>
  );
}
