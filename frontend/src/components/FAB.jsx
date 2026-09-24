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
        border: 'none', color: '#fff',
        cursor: 'pointer',
        boxShadow: '0 12px 32px -6px rgba(113,112,255,.6), 0 0 0 1px rgba(255,255,255,.08), inset 0 1px 0 rgba(255,255,255,.25)',
        background: 'linear-gradient(180deg, #8584ff, #6a69f5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
      onMouseLeave={e => e.currentTarget.style.filter = 'none'}
    >
      {label === '+' ? <Plus size={22} strokeWidth={2.25} /> : label}
    </button>
  );
}
