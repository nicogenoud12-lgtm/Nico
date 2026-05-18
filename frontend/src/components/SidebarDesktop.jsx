import React, { useState } from 'react';
import { C } from '../theme.js';
import { NAV_ITEMS } from '../navItems.js';

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
