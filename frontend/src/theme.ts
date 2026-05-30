import { createTheme } from '@mui/material/styles';

const mobileEditableInputMediaQuery = '@media (max-width:899.95px)';
const mobileEditableInputFontSize = '16px !important';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1d2f68',
      dark: '#162551',
      contrastText: '#fff',
    },
  },
  typography: {
    fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#eef1f4',
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        input: {
          [mobileEditableInputMediaQuery]: {
            fontSize: mobileEditableInputFontSize,
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        input: {
          [mobileEditableInputMediaQuery]: {
            fontSize: mobileEditableInputFontSize,
          },
        },
      },
    },
    MuiFilledInput: {
      styleOverrides: {
        input: {
          [mobileEditableInputMediaQuery]: {
            fontSize: mobileEditableInputFontSize,
          },
        },
      },
    },
    MuiInput: {
      styleOverrides: {
        input: {
          [mobileEditableInputMediaQuery]: {
            fontSize: mobileEditableInputFontSize,
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          [mobileEditableInputMediaQuery]: {
            fontSize: mobileEditableInputFontSize,
          },
        },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        input: {
          [mobileEditableInputMediaQuery]: {
            fontSize: mobileEditableInputFontSize,
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
  },
});

export default theme;