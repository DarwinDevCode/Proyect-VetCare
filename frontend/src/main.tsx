import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
// RNF-011 (interfaz en espanol): hasta la Fase 6 ningun componente formateaba
// nombres de dia/mes (solo DD/MM/YYYY, HH:mm -- sin tokens que dependan de
// locale), asi que alcanzaba con pasar el locale al LocalizationProvider de
// abajo (solo afecta a los DatePicker). El Dashboard es el primero en usar
// "dddd D de MMMM"; sin esto se veria en ingles pese a que el paquete de
// locale ya estaba importado.
dayjs.locale('es');
import { BrowserRouter } from 'react-router-dom';
import { theme } from './theme';
import { AuthProvider } from './auth/AuthContext';
import App from './App.tsx';
// Tipografia del sistema visual "Organic": Figtree para cuerpo, Caprasimo para
// encabezados (ver theme.ts). Paquetes npm en vez de un <link> a Google Fonts:
// no depende de una CDN externa en tiempo de ejecucion (RNF-021: sin instalar
// software adicional, pero tampoco sin depender de que fonts.googleapis.com
// este disponible en la red de la clinica).
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/600.css';
import '@fontsource/figtree/700.css';
import '@fontsource/caprasimo/400.css';
// index.css no estaba importado en ninguna parte: el archivo existia desde el andamiaje
// de Vite pero nunca llegaba al navegador (CssBaseline de MUI ya cubria el reset, por
// eso no se notaba). Se importa ahora porque contiene la hoja de impresion de RI-005.
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </LocalizationProvider>
    </ThemeProvider>
  </StrictMode>,
);
