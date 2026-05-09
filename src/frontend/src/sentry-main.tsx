import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SentryShell } from './sentry/SentryShell';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <SentryShell />
  </StrictMode>
);
