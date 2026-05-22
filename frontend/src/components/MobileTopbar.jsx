import React from 'react';
import { C } from '../theme.js';
import { useHideAmounts } from '../HideAmountsContext.jsx';

const SCREEN_LABELS = {
  movimientos: 'Movimientos',
  gastos: 'Gastos',
  ingresos: 'Ingresos',
  tarjetas: 'Tarjetas',
  recurrentes: 'Recurrentes',
  anual: 'Anual',
  inversiones: 'Inversiones',
  ajustes: 'Ajustes',
};

function EyeIcon({ hidden }) {
  if (hidden) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

export default function MobileTopbar({ screen, onMenu }) {
  const { hidden, toggle } = useHideAmounts();
  return (
    <div style={{
      height: 52, display: 'flex', alignItems: 'center',
      padding: '0 16px', gap: 12,
      background: C.surface, borderBottom: `1px solid ${C.border}`,
      flexShrink: 0,
    }}>
      <button
        onClick={onMenu}
        style={{
          background: 'none', border: 'none', color: C.text2,
          fontSize: 22, cursor: 'pointer', padding: '2px 4px',
          display: 'flex', alignItems: 'center',
        }}
      >
        ☰
      </button>
      <span style={{ fontSize: 16, fontWeight: 600, color: C.text, flex: 1 }}>
        {SCREEN_LABELS[screen] || 'Gastos'}
      </span>
      <button
        onClick={toggle}
        title={hidden ? 'Mostrar montos' : 'Ocultar montos'}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: hidden ? C.text2 : C.text3,
          padding: 4, display: 'flex', alignItems: 'center', borderRadius: 6,
        }}
      >
        <EyeIcon hidden={hidden} />
      </button>
    </div>
  );
}
