import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import { SimProvider } from './state/SimContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SimProvider>
      <App />
    </SimProvider>
  </StrictMode>,
);
