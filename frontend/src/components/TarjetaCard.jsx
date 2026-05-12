import React, { useState } from 'react';
import { CARD_COLORS } from '../theme.js';
import TarjetaBankLogo from './TarjetaBankLogo.jsx';

export default function TarjetaCard({ tarjeta, onClick }) {
  const [hovered, setHovered] = useState(false);
  const validHex = tarjeta.color_hex && /^#[0-9a-fA-F]{6}$/.test(tarjeta.color_hex);
  const [c1, c2] = validHex
    ? [tarjeta.color_hex, tarjeta.color_hex]
    : CARD_COLORS[tarjeta.color_idx % CARD_COLORS.length];

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`,
        borderRadius: 18,
        padding: '22px 26px',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        flexShrink: 0,
        minWidth: 280,
        maxWidth: 340,
        transform: hovered ? 'translateY(-6px) scale(1.01)' : 'translateY(0) scale(1)',
        boxShadow: hovered
          ? `0 20px 48px ${c1}60, 0 8px 20px rgba(0,0,0,.4)`
          : `0 6px 24px ${c1}40, 0 2px 8px rgba(0,0,0,.25)`,
        transition: 'transform .2s ease, box-shadow .2s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,.9)', fontWeight: 700, letterSpacing: '.05em' }}>
          {tarjeta.emisor || ''}
        </span>
        <TarjetaBankLogo banco={tarjeta.banco} logoUrl={tarjeta.logo_url} size={48} />
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
