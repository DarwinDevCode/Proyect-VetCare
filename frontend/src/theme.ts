import { createTheme } from '@mui/material/styles';
import { esES as coreEsES } from '@mui/material/locale';

export const theme = createTheme(
  {
    palette: {
      mode: 'light',
      primary: { main: '#2f6f5e' },
      secondary: { main: '#b5762c' },
      background: { default: '#f4f6f5' },
    },
    typography: {
      fontFamily: ['"Inter"', '"Segoe UI"', 'Roboto', 'Arial', 'sans-serif'].join(','),
    },
    shape: { borderRadius: 10 },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } },
      },
      MuiTextField: {
        defaultProps: { size: 'small' },
      },
    },
  },
  coreEsES,
);
