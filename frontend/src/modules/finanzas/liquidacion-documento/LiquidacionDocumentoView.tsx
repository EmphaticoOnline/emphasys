import { Alert, Box, Button, CircularProgress, Dialog, IconButton, MenuItem, Stack, TextField, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import { NumericFormat } from 'react-number-format';
import type { DatosFiscalesValues } from '../../documentos';
import { DocumentoDatosFiscalesTab } from '../../documentos';
import type { FinanzasCuenta } from '../../../types/finanzas';
import LiquidacionAplicacionesList from './LiquidacionAplicacionesList';
import LiquidacionResumenFooter from './LiquidacionResumenFooter';
import { getCuentaFinancieraDisplayLabel, useLiquidacionDocumento, type LiquidacionDocumentoParams } from './useLiquidacionDocumento';
import {
  LIQUIDACION_FIELD_BORDER,
  LIQUIDACION_NAVY,
  amountFieldSx,
  captureFieldSx,
  fieldLabelSx,
  formaPagoFieldSx,
} from './liquidacionDocumento.styles';

type Props = LiquidacionDocumentoParams & {
  onCancel: () => void;
  onSaved: (documentoId: number) => void;
};

function FieldLabel({ children }: { children: string }) {
  return <Typography sx={fieldLabelSx}>{children}</Typography>;
}

export default function LiquidacionDocumentoView({ onCancel, onSaved, ...params }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isLaptop = useMediaQuery(theme.breakpoints.down('xl'));
  const liquidacion = useLiquidacionDocumento(params);
  const { config } = liquidacion;

  const saveDisabled = !config
    || liquidacion.saving
    || liquidacion.loading
    || liquidacion.tieneExceso
    || !liquidacion.cuentaFinancieraId
    || !(liquidacion.monto > 0);

  const handleSave = async () => {
    const id = await liquidacion.guardar();
    if (id) onSaved(id);
  };

  const handleDialogClose = (_event: object, reason: 'backdropClick' | 'escapeKeyDown') => {
    if (liquidacion.saving) return;
    if (reason === 'backdropClick') return;
    onCancel();
  };

  const railActions = (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.15fr)',
        gap: 1,
        width: '100%',
      }}
    >
      <Button
        variant="outlined"
        color="inherit"
        onClick={onCancel}
        disabled={liquidacion.saving}
        sx={{
          width: '100%',
          height: 36,
          px: 1.25,
          bgcolor: '#fff',
          borderColor: LIQUIDACION_FIELD_BORDER,
          color: LIQUIDACION_NAVY,
          fontWeight: 700,
          textTransform: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        Cancelar
      </Button>
      <Button
        variant="contained"
        color="inherit"
        onClick={() => { void handleSave(); }}
        disabled={saveDisabled}
        sx={{
          width: '100%',
          height: 36,
          px: 1.5,
          fontWeight: 700,
          textTransform: 'none',
          whiteSpace: 'nowrap',
          bgcolor: LIQUIDACION_NAVY,
          color: '#fff',
          '&:hover': { bgcolor: '#162551' },
          '&.Mui-disabled': {
            bgcolor: 'rgba(29,47,104,0.35)',
            color: '#fff',
          },
        }}
      >
        {liquidacion.saving ? 'Guardando...' : config?.textos.guardar}
      </Button>
    </Box>
  );

  if (!config) {
    return (
      <Dialog open onClose={onCancel} maxWidth="xs" fullWidth>
        <Box sx={{ p: 2.5 }}>
          <Alert severity="error">
            Este tipo de documento no admite liquidación de cobro o pago.
          </Alert>
          <Button onClick={onCancel} sx={{ mt: 1.5 }} variant="outlined">Cerrar</Button>
        </Box>
      </Dialog>
    );
  }

  const rail = (
    <LiquidacionResumenFooter
      config={config}
      monto={liquidacion.monto}
      totalAplicado={liquidacion.totalAplicado}
      saldoPorAplicar={liquidacion.saldoPorAplicar}
      exceso={liquidacion.exceso}
      tieneExceso={liquidacion.tieneExceso}
      faltaCuenta={!liquidacion.cuentaFinancieraId}
      formatter={liquidacion.formatter}
      horizontalStats={isLaptop}
      actions={railActions}
    />
  );

  const captura = (
    <Stack spacing={1.25}>
      <Box>
        <FieldLabel>{config.textos.monto}</FieldLabel>
        <Stack direction="row" spacing={1} alignItems="center">
          <NumericFormat
            customInput={TextField}
            hiddenLabel
            value={liquidacion.monto}
            onValueChange={(values) => liquidacion.setMonto(values.floatValue ?? 0)}
            thousandSeparator=","
            decimalSeparator="."
            decimalScale={2}
            fixedDecimalScale
            allowNegative={false}
            prefix="$"
            fullWidth
            size="small"
            inputProps={{ inputMode: 'decimal' }}
            sx={amountFieldSx}
          />
          <Box
            sx={{
              height: 48,
              px: 1.5,
              display: 'flex',
              alignItems: 'center',
              border: `1px solid ${LIQUIDACION_FIELD_BORDER}`,
              borderRadius: '6px',
              bgcolor: '#fff',
              color: LIQUIDACION_NAVY,
              fontSize: 13,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {liquidacion.moneda || 'MXN'}
          </Box>
        </Stack>
      </Box>

      <Grid container spacing={1.25}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <FieldLabel>Fecha</FieldLabel>
          <TextField
            hiddenLabel
            type="date"
            value={liquidacion.fechaDocumento}
            onChange={(e) => liquidacion.setFechaDocumento(e.target.value)}
            fullWidth
            size="small"
            sx={captureFieldSx}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <FieldLabel>Cuenta / caja / banco</FieldLabel>
          <TextField
            hiddenLabel
            select
            required
            value={liquidacion.cuentaFinancieraId ?? ''}
            onChange={(e) => liquidacion.setCuentaFinancieraId(Number(e.target.value) || null)}
            fullWidth
            size="small"
            sx={captureFieldSx}
          >
            <MenuItem value="">Selecciona una cuenta</MenuItem>
            {liquidacion.cuentas.map((cuenta: FinanzasCuenta) => (
              <MenuItem key={cuenta.id} value={cuenta.id}>
                {getCuentaFinancieraDisplayLabel(cuenta)}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <FieldLabel>Forma de pago</FieldLabel>
          <Box sx={formaPagoFieldSx}>
            <DocumentoDatosFiscalesTab
              values={{
                rfc_receptor: '',
                nombre_receptor: '',
                regimen_fiscal_receptor: '',
                uso_cfdi: '',
                forma_pago: liquidacion.formaPago,
                metodo_pago: '',
                codigo_postal_receptor: '',
              }}
              onChange={(changes: Partial<DatosFiscalesValues>) => {
                if (changes.forma_pago !== undefined) liquidacion.setFormaPago(changes.forma_pago || '');
              }}
              visibleFields={{
                forma_pago: true,
                rfc_receptor: false,
                nombre_receptor: false,
                regimen_fiscal_receptor: false,
                uso_cfdi: false,
                metodo_pago: false,
                codigo_postal_receptor: false,
              }}
              showCatalogNote={false}
              compact
            />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <FieldLabel>Referencia</FieldLabel>
          <TextField
            hiddenLabel
            value={liquidacion.referencia}
            onChange={(e) => liquidacion.setReferencia(e.target.value)}
            fullWidth
            size="small"
            placeholder="SPEI, cheque, folio banco"
            sx={captureFieldSx}
          />
        </Grid>
        {liquidacion.moneda !== 'MXN' ? (
          <Grid size={{ xs: 12, sm: 6 }}>
            <FieldLabel>Tipo de cambio</FieldLabel>
            <NumericFormat
              customInput={TextField}
              hiddenLabel
              value={liquidacion.tipoCambio}
              onValueChange={(values) => liquidacion.setTipoCambio(values.floatValue && values.floatValue > 0 ? values.floatValue : 1)}
              thousandSeparator=","
              decimalSeparator="."
              decimalScale={4}
              allowNegative={false}
              fullWidth
              size="small"
              inputProps={{ inputMode: 'decimal', style: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }}
              sx={captureFieldSx}
            />
          </Grid>
        ) : null}
      </Grid>

      <Box>
        <FieldLabel>Observaciones</FieldLabel>
        <TextField
          hiddenLabel
          value={liquidacion.observaciones}
          onChange={(e) => liquidacion.setObservaciones(e.target.value)}
          fullWidth
          size="small"
          placeholder="Opcional"
          sx={captureFieldSx}
        />
      </Box>

      {config.textos.notaComplemento ? (
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
          {config.textos.notaComplemento}
        </Typography>
      ) : null}
    </Stack>
  );

  const alerts = (
    <>
      {liquidacion.error ? (
        <Alert severity="error" onClose={() => liquidacion.setError(null)}>
          {liquidacion.error}
        </Alert>
      ) : null}
      {liquidacion.tieneExceso && !liquidacion.loading ? (
        <Alert severity="error">
          {config.textos.exceso(liquidacion.formatter.format(liquidacion.exceso))}
        </Alert>
      ) : null}
    </>
  );

  const mainContent = liquidacion.loading ? (
    <Stack alignItems="center" justifyContent="center" sx={{ flex: 1, py: 8 }} spacing={1}>
      <CircularProgress size={32} />
      <Typography variant="body2">Cargando liquidación…</Typography>
    </Stack>
  ) : (
    <>
      {captura}
      <LiquidacionAplicacionesList
        config={config}
        filas={liquidacion.filas}
        aplicaciones={liquidacion.aplicaciones}
        formatter={liquidacion.formatter}
        useCards={isMobile}
        onChangeAplicacion={liquidacion.setAplicacionFila}
      />
    </>
  );

  return (
    <Dialog
      open
      onClose={handleDialogClose}
      fullScreen={isMobile}
      maxWidth={false}
      aria-labelledby="liquidacion-documento-title"
      slotProps={{
        backdrop: {
          sx: { bgcolor: 'rgba(15, 23, 42, 0.28)' },
        },
        paper: {
          sx: {
            width: { xs: '100%', md: '80vw', lg: '74vw', xl: '70vw' },
            maxWidth: { md: 1120 },
            height: { xs: '100%', md: 'auto' },
            maxHeight: { xs: '100%', md: '90vh' },
            m: { xs: 0, md: 2 },
            borderRadius: { xs: 0, md: 2 },
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            bgcolor: '#f4f6f9',
          },
        },
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.5,
          px: { xs: 1.5, md: 2.25 },
          py: 1.25,
          bgcolor: '#fff',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography id="liquidacion-documento-title" sx={{ fontSize: 18, fontWeight: 700, color: LIQUIDACION_NAVY, lineHeight: 1.25 }}>
            {config.textos.titulo(liquidacion.folio)}
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            {config.textos.contraparte} · {liquidacion.contactoNombre || '—'}
          </Typography>
        </Box>
        <IconButton
          aria-label="Cerrar"
          onClick={onCancel}
          disabled={liquidacion.saving}
          size="small"
          sx={{ color: '#64748b', mt: 0.25 }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box
        sx={{
          flex: '1 1 auto',
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: isLaptop || liquidacion.loading ? '1fr' : 'minmax(0, 1fr) 252px',
          alignItems: 'stretch',
        }}
      >
        <Box
          sx={{
            minWidth: 0,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            p: { xs: 1.5, md: 2 },
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          }}
        >
          {alerts}
          {mainContent}
          {isLaptop && !liquidacion.loading ? rail : null}
        </Box>

        {!isLaptop && !liquidacion.loading ? (
          <Box
            sx={{
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              borderLeft: '1px solid #e5e7eb',
              bgcolor: '#fff',
              p: 1.25,
            }}
          >
            <Box sx={{ position: 'sticky', top: 0 }}>
              {rail}
            </Box>
          </Box>
        ) : null}
      </Box>
    </Dialog>
  );
}
