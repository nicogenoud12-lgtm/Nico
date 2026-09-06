import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from './auth/AuthContext.jsx';
import './index.css';
import { setupPwaAutoUpdate } from './pwa.js';

setupPwaAutoUpdate();

ReactDOM.createRoot(document.getElementById('app-root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
