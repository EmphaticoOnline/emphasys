import React from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline } from '@mui/material';
import App from './App';
import BrandThemeProvider from './theme/BrandThemeProvider';
import { SessionProvider } from './session/SessionContext';
import DateLocalizationProvider from './shared/dates/DateLocalizationProvider';

import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/500.css';
import '@fontsource/source-sans-3/600.css';
import '@fontsource/source-sans-3/700.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrandThemeProvider themeId="classic">
      <CssBaseline />
      <DateLocalizationProvider>
        <SessionProvider>
          <App />
        </SessionProvider>
      </DateLocalizationProvider>
    </BrandThemeProvider>
  </React.StrictMode>
);
