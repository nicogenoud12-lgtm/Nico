import React from 'react';
import { C, blur } from '../theme.js';
import { NAV_ITEMS } from '../navItems.js';
import { useHideAmounts } from '../HideAmountsContext.jsx';
import { Eye, EyeOff, Menu } from './Icons.jsx';

const SCREEN_LABELS = Object.fromEntries(NAV_ITEMS.map(i => [i.id, i.label]));

export default function MobileTopbar({ screen, onMenu }) {
  const { hidden, toggle } = useHideAmounts();
  const iconBtn = {
    background: 'none', border: 'none', cursor: 'pointer',
    width: 36, height: 36, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: 'env(safe-area-inset-top) 8px 0', minHeight: 'calc(52px + env(safe-area-inset-top))', gap: 4,
      background: 'rgba(9,9,11,0.55)', ...blur(20), borderBottom: `1px solid ${C.border}`,
      flexShrink: 0, position: 'relative', zIndex: 60,
    }}>
      <button onClick={onMenu} aria-label="Menú" style={{ ...iconBtn, color: C.text2 }}>
        <Menu size={20} />
      </button>
      <span style={{ fontSize: 16, fontWeight: 600, color: C.text, flex: 1, letterSpacing: '-0.01em' }}>
        {SCREEN_LABELS[screen] || 'Gastos'}
      </span>
      <button
        onClick={toggle}
        title={hidden ? 'Mostrar montos' : 'Ocultar montos'}
        style={{ ...iconBtn, color: hidden ? C.text : C.text3, background: hidden ? C.surface2 : 'none' }}
      >
        {hidden ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
