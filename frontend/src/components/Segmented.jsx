import React from 'react';
import { C } from '../theme.js';

// Control segmentado (tabs tipo pastilla). options: [[value, label, activeColor?], ...]
export default function Segmented({ options, value, onChange, full = false, size = 'md' }) {
  const pad = size === 'sm' ? '5px 12px' : '8px 14px';
  return (
    <div style={{
      display: full ? 'flex' : 'inline-flex', gap: 2, padding: 3,
      background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: 11,
    }}>
      {options.map(([v, l, color]) => {
        const active = value === v;
        return (
          <button
            key={v} type="button" onClick={() => onChange(v)}
            style={{
              flex: full ? 1 : undefined, padding: pad, borderRadius: 8,
              border: 'none', cursor: 'pointer',
              fontSize: size === 'sm' ? 12.5 : 14, fontWeight: active ? 600 : 500,
              background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: active ? (color || C.text) : C.text3,
              boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,.08), 0 2px 8px -2px rgba(0,0,0,.6)' : 'none',
            }}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}
