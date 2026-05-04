import React from 'react';
import { C } from '../theme.js';

const NAV_ITEMS = [
  { id: 'movimientos', label: 'Movimientos', icon: '↕' },
  { id: 'gastos', label: 'Gastos', icon: '↓' },
  { id: 'ingresos', label: 'Ingresos', icon: '↑' },
  { id: 'tarjetas', label: 'Tarjetas', icon: '▪' },
  { id: 'anual', label: 'Anual', icon: '▦' },
  { id: 'ajustes', label: 'Ajustes', icon: '⚙' },
];

export default function Sidebar({ open, onClose, screen, onNav }) {
  if (!open) return null;
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
        }}
      />
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 201,
        width: 260, background: C.surface, borderRight: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column', padding: '20px 12px',
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform .25s ease',
      }}>
        <div style={{ padding: '0 8px 24px', fontSize: 17, fontWeight: 700, color: C.text }}>
          Gastos
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => { onNav(item.id); onClose(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8,
                background: screen === item.id ? C.surface2 : 'transparent',
                border: 'none',
                color: screen === item.id ? C.text : C.text2,
                fontFamily: 'inherit', fontSize: 14,
                fontWeight: screen === item.id ? 600 : 400,
                cursor: 'pointer', textAlign: 'left',
                transition: 'background .15s',
              }}
            >
              <span style={{ fontSize: 16, width: 20, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}
