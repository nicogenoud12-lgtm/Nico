import React from 'react';
import { C } from '../theme.js';

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

export default function MobileTopbar({ screen, onMenu }) {
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
      <span style={{ fontSize: 16, fontWeight: 600, color: C.text }}>
        {SCREEN_LABELS[screen] || 'Gastos'}
      </span>
    </div>
  );
}
