import type { SxProps, Theme } from '@mui/material/styles';

export const LIQUIDACION_NAVY = '#1d2f68';
export const LIQUIDACION_BORDER = '#e5e7eb';
export const LIQUIDACION_FIELD_BORDER = '#cbd5e1';
export const LIQUIDACION_FIELD_BG = '#f8fafc';
export const LIQUIDACION_AMBER = '#b45309';
export const LIQUIDACION_LABEL = '#8b93a7';

export const fieldLabelSx: SxProps<Theme> = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: LIQUIDACION_LABEL,
  lineHeight: 1.2,
  mb: 0.5,
};

export const valueSlotSx: SxProps<Theme> = {
  minHeight: 40,
  display: 'flex',
  alignItems: 'center',
};

const outlinedFieldRoot = {
  bgcolor: '#fff',
  backgroundColor: '#fff',
  backgroundImage: 'none',
  borderRadius: '6px',
  '& fieldset': { borderColor: LIQUIDACION_FIELD_BORDER },
  '&:hover': { backgroundColor: '#fff' },
  '&:hover fieldset': { borderColor: '#94a3b8' },
  '&.Mui-focused': { backgroundColor: '#fff' },
  '&.Mui-focused fieldset': {
    borderColor: LIQUIDACION_NAVY,
    borderWidth: '1px',
  },
};

export const captureFieldSx: SxProps<Theme> = {
  '& .MuiOutlinedInput-root': {
    ...outlinedFieldRoot,
    height: 40,
    fontSize: 14,
  },
  '& .MuiOutlinedInput-input': {
    py: 0,
    height: 40,
    boxSizing: 'border-box',
    fontSize: 14,
    backgroundColor: '#fff',
  },
  '& .MuiSelect-select': {
    display: 'flex',
    alignItems: 'center',
    height: 40,
    py: 0,
    boxSizing: 'border-box',
    backgroundColor: '#fff',
  },
};

export const formaPagoFieldSx: SxProps<Theme> = {
  '& .MuiStack-root': { gap: 0 },
  '& .MuiStack-root > .MuiBox-root': {
    gridTemplateColumns: '1fr !important',
  },
  '& .MuiInputLabel-root': { display: 'none' },
  '& legend': { display: 'none' },
  '& .MuiOutlinedInput-notchedOutline': {
    top: 0,
    legend: { display: 'none', width: 0 },
  },
  '& .MuiOutlinedInput-root': {
    ...outlinedFieldRoot,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    height: 40,
    minHeight: 40,
    py: 0,
    pl: 1.5,
    pr: '32px',
    fontSize: 14,
  },
  '& .MuiOutlinedInput-input': {
    py: '0 !important',
    height: 40,
    boxSizing: 'border-box',
    fontSize: '14px !important',
    backgroundColor: '#fff',
  },
  '& .MuiAutocomplete-input': {
    fontSize: '14px !important',
    padding: '0 !important',
    backgroundColor: '#fff',
  },
  '& .MuiAutocomplete-root .MuiOutlinedInput-root .MuiAutocomplete-endAdornment': {
    top: 0,
    bottom: 0,
    right: 7,
    height: '100%',
    maxHeight: 'none',
    transform: 'none',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
  },
  '& .MuiAutocomplete-popupIndicator, & .MuiAutocomplete-clearIndicator': {
    padding: 0,
    width: 24,
    height: 24,
    margin: 0,
  },
};

export const amountFieldSx: SxProps<Theme> = {
  '& .MuiOutlinedInput-root': {
    ...outlinedFieldRoot,
    height: 48,
    fontSize: 22,
  },
  '& .MuiOutlinedInput-input': {
    py: 0,
    height: 48,
    boxSizing: 'border-box',
    fontSize: 22,
    fontWeight: 700,
    color: LIQUIDACION_NAVY,
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'right',
    backgroundColor: '#fff',
  },
};
