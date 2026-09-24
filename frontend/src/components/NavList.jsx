import React, { useState } from 'react';
import { C } from '../theme.js';
import { NAV_ITEMS } from '../navItems.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useHideAmounts } from '../HideAmountsContext.jsx';
import { Eye, EyeOff, LogoMark } from './Icons.jsx';

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
          filter: active ? 'brightness(0) invert(1)' : 'brightness(0) invert(0.5)',
          transition: 'filter .15s',
        }}
      />
    );
  }
  return (
    <span style={{ fontSize: 15, width: 18, textAlign: 'center', flexShrink: 0 }}>
      {item.icon}
    </span>
  );
}

// Contenido compartido del sidebar (desktop fijo y drawer mobile):
// marca + toggle de montos, navegación y usuario al pie.
export default function NavList({ screen, onNav }) {
  const { hidden, toggle } = useHideAmounts();
  const { user } = useAuth();
  const [hover, setHover] = useState(null);

  return (
    <>
      <div style={{ padding: '2px 8px 22px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <LogoMark size={28} />
        <span style={{ fontSize: 15, fontWeight: 650, color: C.text, letterSpacing: '-0.01em', flex: 1 }}>Gastos</span>
        <button
          onClick={toggle}
          title={hidden ? 'Mostrar montos' : 'Ocultar montos'}
          style={{
            background: hidden ? C.surface2 : 'transparent', border: 'none', cursor: 'pointer',
            color: hidden ? C.text : C.text3,
            width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8,
          }}
        >
          {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, overflowY: 'auto' }}>
        {NAV_ITEMS.map(item => {
          const active = screen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNav(item.id)}
              onMouseEnter={() => setHover(item.id)}
              onMouseLeave={() => setHover(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 11,
                padding: '8px 10px', borderRadius: 9,
                background: active ? C.surface2 : hover === item.id ? 'rgba(255,255,255,.03)' : 'transparent',
                border: 'none',
                boxShadow: active ? `inset 0 0 0 1px ${C.border}` : 'none',
                color: active ? C.text : C.text2,
                fontSize: 14, fontWeight: active ? 550 : 450,
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <NavIcon item={item} active={active} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {user && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 8px 2px', marginTop: 12, borderTop: `1px solid ${C.border}`,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: C.accentBg, color: '#b4b3ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 650, textTransform: 'uppercase',
          }}>
            {(user.username || '?').slice(0, 1)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 550, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.username}
            </div>
            <div style={{ fontSize: 11.5, color: C.text3 }}>{user.is_admin ? 'Administrador' : 'Usuario'}</div>
          </div>
        </div>
      )}
    </>
  );
}
