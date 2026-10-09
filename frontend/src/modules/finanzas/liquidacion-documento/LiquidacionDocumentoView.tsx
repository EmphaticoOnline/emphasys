import { Alert, Autocomplete, Box, Button, CircularProgress, Dialog, IconButton, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useRef } from 'react';
import Grid from '@mui/material/Grid';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha, useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import { NumericFormat } from 'react-number-format';
import type { DatosFiscalesValues } from '../../documentos';
import { DocumentoDatosFiscalesTab } from '../../documentos';
import LiquidacionAplicacionesList from './LiquidacionAplicacionesList';
import LiquidacionResumenFooter from './LiquidacionResumenFooter';
import { getCuentaFinancieraDisplayLabel, useLiquidacionDocumento, type LiquidacionDocumentoParams } from './useLiquidacionDocumento';
import {
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
  const tokens = theme.emphasys;
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isLaptop = useMediaQuery(theme.breakpoints.down('xl'));
  const liquidacion = useLiquidacionDocumento(params);
  const { config } = liquidacion;
  const importeRef = useRef<HTMLInputElement | null>(null);
  const importeEnfocadoRef = useRef(false);

  useEffect(() => {
    if (liquidacion.loading) {
      importeEnfocadoRef.current = false;
      return;
    }
    if (!importeEnfocadoRef.current && liquidacion.monto > 0) {
      importeRef.current?.focus();
      importeRef.current?.select();
      importeEnfocadoRef.current = true;
    }
  }, [liquidacion.loading, liquidacion.monto]);

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
          bgcolor: tokens.content.card,
          borderColor: tokens.content.border,
          color: tokens.content.foreground,
          '&:hover': { bgcolor: tokens.content.hover, borderColor: tokens.content.foreground },
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
          bgcolor: tokens.action.primary,
          color: tokens.action.primaryForeground,
          '&:hover': { bgcolor: tokens.action.primaryHover },
          '&.Mui-disabled': {
            bgcolor: tokens.action.disabled,
            color: tokens.action.primaryForeground,
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
            inputRef={importeRef}
            inputProps={{ inputMode: 'decimal' }}
            sx={amountFieldSx}
          />
          <Box
            sx={{
              height: 56,
              px: 1.5,
              display: 'flex',
              alignItems: 'center',
              border: `1px solid ${tokens.content.border}`,
              borderRadius: '10px',
              bgcolor: tokens.metric.amount.background,
              color: tokens.content.foreground,
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
          <FieldLabel>Cuenta</FieldLabel>
          <Autocomplete
            options={liquidacion.cuentas}
            value={liquidacion.cuentas.find((cuenta) => Number(cuenta.id) === Number(liquidacion.cuentaFinancieraId)) ?? null}
            onChange={(_, cuenta) => liquidacion.setCuentaFinancieraId(cuenta ? Number(cuenta.id) : null)}
            getOptionLabel={getCuentaFinancieraDisplayLabel}
            isOptionEqualToValue={(option, value) => Number(option.id) === Number(value.id)}
            noOptionsText="Sin cuentas disponibles"
            clearText="Limpiar cuenta"
            openText="Abrir cuentas"
            closeText="Cerrar cuentas"
            clearOnEscape={false}
            fullWidth
            size="small"
            sx={formaPagoFieldSx}
            renderInput={(params) => (
              <TextField
                {...params}
                hiddenLabel
                required
                placeholder="Selecciona o escribe una cuenta"
                size="small"
              />
            )}
          />
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
        <Typography sx={{ fontSize: 12.5, lineHeight: 1.45, color: tokens.content.secondary, bgcolor: tokens.content.elevated, border: `1px solid ${tokens.content.border}`, borderRadius: 2, px: 1.25, py: 0.9 }}>
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
      maxWidth={false}
      aria-labelledby="liquidacion-documento-title"
      slotProps={{
        backdrop: {
          sx: { bgcolor: alpha(tokens.content.foreground, 0.28) },
        },
        paper: {
          sx: {
            width: { xs: '100%', md: '80vw', lg: '74vw', xl: '70vw' },
            maxWidth: { md: 1120 },
            height: { xs: '100%', md: 'calc(100vh - 32px)' },
            maxHeight: { xs: '100%', md: 'calc(100vh - 32px)' },
            m: { xs: 0, md: 2 },
            borderRadius: { xs: 0, md: 3 },
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            bgcolor: tokens.content.background,
            color: tokens.content.foreground,
            border: `1px solid ${tokens.content.border}`,
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
          bgcolor: tokens.content.elevated,
          borderBottom: `1px solid ${tokens.content.border}`,
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography id="liquidacion-documento-title" variant="figure" sx={{ display: 'block', fontSize: 28, lineHeight: 1, color: tokens.content.foreground }}>
            {config.textos.titulo(liquidacion.folio)}
          </Typography>
          <Typography sx={{ mt: 0.55, fontSize: 14, color: tokens.content.secondary }}>
            {config.textos.contraparte} · {liquidacion.contactoNombre || '—'}
          </Typography>
        </Box>
        <IconButton
          aria-label="Cerrar"
          onClick={onCancel}
          disabled={liquidacion.saving}
          size="small"
          sx={{ color: tokens.content.muted, mt: 0.25, '&:hover': { bgcolor: tokens.content.hover, color: tokens.content.foreground } }}
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
              borderLeft: `1px solid ${tokens.content.border}`,
              bgcolor: tokens.content.elevated,
              p: 1.25,
            }}
          >
            <Box sx={{ position: 'sticky', top: 0 }}>
              {rail}
            </Box>
          </Box>
        ) : null}
      </Box>

      <Box
        sx={{
          flexShrink: 0,
          px: { xs: 1.5, md: 2 },
          py: 1.25,
          bgcolor: tokens.content.elevated,
          borderTop: `1px solid ${tokens.content.border}`,
        }}
      >
        {railActions}
      </Box>
    </Dialog>
  );
}
