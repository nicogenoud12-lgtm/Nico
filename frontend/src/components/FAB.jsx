import React from 'react';
import { C } from '../theme.js';
import { Plus } from './Icons.jsx';

export default function FAB({ onClick, label = '+' }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label === '+' ? 'Agregar' : label}
      style={{
        position: 'fixed', zIndex: 100,
        bottom: 'calc(24px + env(safe-area-inset-bottom))', right: 24,
        width: 52, height: 52, borderRadius: 16,
        background: C.accent, border: 'none', color: '#fff',
        cursor: 'pointer',
        boxShadow: '0 8px 24px -6px rgba(113,112,255,.55), inset 0 1px 0 rgba(255,255,255,.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseEnter={e => e.currentTarget.style.background = '#8281ff'}
      onMouseLeave={e => e.currentTarget.style.background = C.accent}
    >
      {label === '+' ? <Plus size={22} strokeWidth={2.25} /> : label}
    </button>
  );
}
