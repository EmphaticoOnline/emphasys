import type { SxProps, Theme } from '@mui/material/styles';

const outlinedFieldRoot = (theme: Theme) => ({
  bgcolor: theme.emphasys.content.card,
  backgroundColor: theme.emphasys.content.card,
  backgroundImage: 'none',
  borderRadius: '10px',
  '& fieldset': { borderColor: theme.emphasys.content.border },
  '&:hover': { backgroundColor: theme.emphasys.content.card },
  '&:hover fieldset': { borderColor: theme.emphasys.content.foreground },
  '&.Mui-focused': { backgroundColor: theme.emphasys.content.card },
  '&.Mui-focused fieldset': {
    borderColor: theme.emphasys.content.foreground,
    borderWidth: '1px',
  },
});

export const fieldLabelSx: SxProps<Theme> = (theme) => ({
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: theme.emphasys.content.muted,
  lineHeight: 1.2,
  mb: 0.5,
});

export const valueSlotSx: SxProps<Theme> = {
  minHeight: 40,
  display: 'flex',
  alignItems: 'center',
};

export const captureFieldSx: SxProps<Theme> = (theme) => ({
  '& .MuiOutlinedInput-root': {
    ...outlinedFieldRoot(theme),
    height: 40,
    fontSize: 14,
    color: theme.emphasys.content.foreground,
  },
  '& .MuiOutlinedInput-input': {
    py: 0,
    height: 40,
    boxSizing: 'border-box',
    fontSize: 14,
    color: theme.emphasys.content.foreground,
    backgroundColor: theme.emphasys.content.card,
  },
  '& .MuiSelect-select': {
    display: 'flex',
    alignItems: 'center',
    height: 40,
    py: 0,
    boxSizing: 'border-box',
    color: theme.emphasys.content.foreground,
    backgroundColor: theme.emphasys.content.card,
  },
});

export const formaPagoFieldSx: SxProps<Theme> = (theme) => ({
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
    ...outlinedFieldRoot(theme),
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    height: 40,
    minHeight: 40,
    py: 0,
    pl: 1.5,
    pr: '32px',
    fontSize: 14,
    color: theme.emphasys.content.foreground,
  },
  '& .MuiOutlinedInput-input': {
    py: '0 !important',
    height: 40,
    boxSizing: 'border-box',
    fontSize: '14px !important',
    color: theme.emphasys.content.foreground,
    backgroundColor: theme.emphasys.content.card,
  },
  '& .MuiAutocomplete-input': {
    fontSize: '14px !important',
    padding: '0 !important',
    color: theme.emphasys.content.foreground,
    backgroundColor: theme.emphasys.content.card,
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
    color: theme.emphasys.content.muted,
  },
});

export const amountFieldSx: SxProps<Theme> = (theme) => ({
  '& .MuiOutlinedInput-root': {
    ...outlinedFieldRoot(theme),
    height: 56,
    bgcolor: theme.emphasys.metric.amount.background,
    backgroundColor: theme.emphasys.metric.amount.background,
    '&:hover': { backgroundColor: theme.emphasys.metric.amount.background },
    '&.Mui-focused': { backgroundColor: theme.emphasys.metric.amount.background },
  },
  '& .MuiOutlinedInput-input': {
    py: 0,
    height: 56,
    boxSizing: 'border-box',
    fontFamily: theme.typography.figure.fontFamily,
    fontSize: 28,
    fontWeight: 500,
    color: theme.emphasys.content.foreground,
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'right',
    backgroundColor: theme.emphasys.metric.amount.background,
  },
});
