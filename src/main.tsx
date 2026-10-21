import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { installAppRecovery } from './app/recovery';

installAppRecovery();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
