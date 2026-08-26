import { createTheme } from '@mui/material/styles';
import { esES as coreEsES } from '@mui/material/locale';

// Tokens del sistema visual "Organic" (paleta terracota/oliva, tipografia
// Caprasimo para encabezados, Figtree para cuerpo). Se exportan aparte de
// createTheme() porque MUI no tiene un lugar nativo para una rampa de 9 tonos
// por color (palette.primary/secondary solo admiten main/light/dark) -- se usan
// directamente en sx={{...}} donde un Chip/Alert necesita un par 100/800 que
// las paletas de MUI no cubren (ver CLAUDE.md seccion 11: todo estilo pasa por
// sx, nunca por props sueltas).
//
// Los color-mix() de la hoja de estilos original se precalculan aqui a rgba()
// fijo -- mas seguro que depender de soporte de color-mix() en todos los
// navegadores que use la clinica (RNF-020: navegadores actualizados de uso
// extendido, no necesariamente los mas nuevos).
export const ORGANIC = {
  bg: '#f5ead8',
  surface: '#ebddc5',
  text: '#201e1d',
  divider: 'rgba(32, 30, 29, 0.16)',
  neutral: {
    100: '#f9f4ed',
    200: '#eee7db',
    300: '#dcd3c4',
    400: '#c0b6a5',
    500: '#a19786',
    600: '#82796a',
    700: '#645c50',
    800: '#474238',
    900: '#2e2b25',
  },
  accent: {
    100: '#fff2eb',
    200: '#ffe1d0',
    300: '#ffc6a5',
    400: '#f6a06b',
    500: '#d67f48',
    600: '#b2622d',
    700: '#8c491a',
    800: '#643312',
    900: '#402310',
  },
  accent2: {
    100: '#f0fae1',
    200: '#e1eecc',
    300: '#ccdbb2',
    400: '#aebf92',
    500: '#8fa073',
    600: '#728157',
    700: '#56633f',
    800: '#3d472b',
    900: '#272e1b',
  },
  radius: { sm: 8, md: 16, lg: 32 },
  shadow: {
    sm: '0 1px 2px rgba(46, 43, 37, 0.14)',
    md: '0 3px 10px rgba(46, 43, 37, 0.16)',
    lg: '0 12px 32px rgba(46, 43, 37, 0.22)',
  },
} as const;

const FUENTE_ENCABEZADO = '"Caprasimo", "Segoe UI", system-ui, sans-serif';
const FUENTE_CUERPO = '"Figtree", "Segoe UI", Roboto, Arial, sans-serif';

const VARIANTE_ENCABEZADO = { fontFamily: FUENTE_ENCABEZADO, fontWeight: 400 };

export const theme = createTheme(
  {
    palette: {
      mode: 'light',
      primary: {
        main: ORGANIC.accent[600],
        light: ORGANIC.accent[400],
        dark: ORGANIC.accent[800],
        contrastText: ORGANIC.bg,
      },
      secondary: {
        main: ORGANIC.accent2[600],
        light: ORGANIC.accent2[400],
        dark: ORGANIC.accent2[800],
        contrastText: ORGANIC.neutral[100],
      },
      background: { default: ORGANIC.bg, paper: ORGANIC.surface },
      text: { primary: ORGANIC.text, secondary: ORGANIC.neutral[700] },
      divider: ORGANIC.divider,
    },
    typography: {
      fontFamily: FUENTE_CUERPO,
      h1: VARIANTE_ENCABEZADO,
      h2: VARIANTE_ENCABEZADO,
      h3: VARIANTE_ENCABEZADO,
      h4: VARIANTE_ENCABEZADO,
      h5: VARIANTE_ENCABEZADO,
      h6: VARIANTE_ENCABEZADO,
    },
    shape: { borderRadius: ORGANIC.radius.sm },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { textTransform: 'none', fontWeight: 600, borderRadius: 999 } },
      },
      MuiChip: {
        styleOverrides: { root: { borderRadius: 999 } },
      },
      MuiTextField: {
        defaultProps: { size: 'small' },
      },
      MuiOutlinedInput: {
        styleOverrides: { root: { borderRadius: 999 } },
      },
      MuiToggleButtonGroup: {
        styleOverrides: { root: { borderRadius: 999, padding: 4, gap: 4 } },
      },
      MuiToggleButton: {
        styleOverrides: { root: { borderRadius: 999, border: 'none' } },
      },
      MuiDialog: {
        styleOverrides: { paper: { borderRadius: ORGANIC.radius.lg, boxShadow: ORGANIC.shadow.lg } },
      },
      MuiCard: {
        styleOverrides: { root: { borderRadius: ORGANIC.radius.md } },
      },
      MuiAppBar: {
        styleOverrides: { root: { boxShadow: ORGANIC.shadow.sm } },
      },
    },
  },
  coreEsES,
);
