import React from 'react';
import { C } from '../theme.js';

const NAV_ITEMS = [
  { id: 'movimientos', label: 'Movimientos', icon: '↕' },
  { id: 'gastos', label: 'Gastos', icon: '↓' },
  { id: 'ingresos', label: 'Ingresos', icon: '↑' },
  { id: 'tarjetas', label: 'Tarjetas', icon: '▪' },
  { id: 'suscripciones', label: 'Suscripciones', icon: '↻' },
  { id: 'anual', label: 'Anual', icon: '▦' },
  { id: 'inversiones', label: 'Inversiones', icon: '◈' },
  { id: 'ajustes', label: 'Ajustes', icon: '⚙' },
];

export default function SidebarDesktop({ screen, onNav }) {
  return (
    <div style={{
      width: 220, flexShrink: 0,
      background: C.surface, borderRight: `1px solid ${C.border}`,
      height: '100%', display: 'flex', flexDirection: 'column',
      padding: '20px 12px',
    }}>
      <div style={{ padding: '0 8px 24px', fontSize: 17, fontWeight: 700, color: C.text, letterSpacing: '-0.3px' }}>
        Gastos
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => onNav(item.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 8,
              background: screen === item.id ? C.surface2 : 'transparent',
              border: 'none',
              color: screen === item.id ? C.text : C.text2,
              fontFamily: 'inherit', fontSize: 14,
              fontWeight: screen === item.id ? 600 : 400,
              cursor: 'pointer', textAlign: 'left',
              transition: 'background .15s, color .15s',
            }}
          >
            <span style={{ fontSize: 16, width: 20, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
