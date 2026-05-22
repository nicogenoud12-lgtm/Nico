import React, { useState } from 'react';
import { C } from '../theme.js';
import { NAV_ITEMS } from '../navItems.js';
import { useHideAmounts } from '../HideAmountsContext.jsx';

function NavIcon({ item, active }) {
  const [err, setErr] = useState(false);
  if (!err) {
    return (
      <img
        src={`/icons/${item.id}.svg`}
        alt=""
        onError={() => setErr(true)}
        style={{
          width: 18, height: 18, flexShrink: 0,
          filter: active ? 'brightness(0) invert(1)' : 'brightness(0) invert(0.55)',
        }}
      />
    );
  }
  return (
    <span style={{ fontSize: 16, width: 20, textAlign: 'center', flexShrink: 0 }}>
      {item.icon}
    </span>
  );
}

function EyeIcon({ hidden }) {
  if (hidden) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

export default function SidebarDesktop({ screen, onNav }) {
  const { hidden, toggle } = useHideAmounts();
  return (
    <div style={{
      width: 220, flexShrink: 0,
      background: C.surface, borderRight: `1px solid ${C.border}`,
      height: '100%', display: 'flex', flexDirection: 'column',
      padding: '20px 12px',
    }}>
      <div style={{ padding: '0 8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: C.text, letterSpacing: '-0.3px' }}>Gastos</span>
        <button
          onClick={toggle}
          title={hidden ? 'Mostrar montos' : 'Ocultar montos'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: hidden ? C.text2 : C.text3,
            padding: 4, display: 'flex', alignItems: 'center', borderRadius: 6,
            transition: 'color .15s',
          }}
        >
          <EyeIcon hidden={hidden} />
        </button>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {NAV_ITEMS.map(item => {
          const active = screen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNav(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 8,
                background: active ? C.surface2 : 'transparent',
                border: 'none',
                color: active ? C.text : C.text2,
                fontFamily: 'inherit', fontSize: 14,
                fontWeight: active ? 600 : 400,
                cursor: 'pointer', textAlign: 'left',
                transition: 'background .15s, color .15s',
              }}
            >
              <NavIcon item={item} active={active} />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
