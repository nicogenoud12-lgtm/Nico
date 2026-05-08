import React from 'react';
import { C } from '../theme.js';

export default function FAB({ onClick, label = '+' }) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 100,
        width: 56, height: 56, borderRadius: '50%',
        background: C.accent, border: 'none', color: '#fff',
        fontSize: 28, fontWeight: 300, cursor: 'pointer',
        boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'transform .15s',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      {label}
    </button>
  );
}
