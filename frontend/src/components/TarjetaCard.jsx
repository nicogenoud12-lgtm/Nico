import React from 'react';
import { CARD_COLORS } from '../theme.js';
import TarjetaBankLogo from './TarjetaBankLogo.jsx';

export default function TarjetaCard({ tarjeta, onClick }) {
  const [c1, c2] = CARD_COLORS[tarjeta.color_idx % CARD_COLORS.length];

  return (
    <div
      onClick={onClick}
      style={{
        background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`,
        borderRadius: 16, padding: '20px 24px',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none', flexShrink: 0,
        minWidth: 280, maxWidth: 320,
        boxShadow: `0 8px 32px ${c1}40`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <TarjetaBankLogo banco={tarjeta.banco} />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.7)', fontWeight: 500 }}>
          {tarjeta.banco}
        </span>
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: 16, color: '#fff', letterSpacing: 3, marginBottom: 16 }}>
        •••• •••• •••• {tarjeta.ultimos4 || '••••'}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', marginBottom: 2 }}>TITULAR</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{tarjeta.nombre}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {tarjeta.cierre && (
            <div>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,.6)' }}>CIERRE </span>
              <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>{tarjeta.cierre}</span>
            </div>
          )}
          {tarjeta.vence && (
            <div>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,.6)' }}>VENCE </span>
              <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>{tarjeta.vence}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
