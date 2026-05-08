import React from 'react';

const BANK_INITIALS = {
  galicia: 'G',
  santander: 'S',
  macro: 'M',
  bbva: 'B',
  icbc: 'I',
  brubank: 'BR',
  naranja: 'N',
  personal: 'P',
  uala: 'U',
  mercadopago: 'MP',
};

export default function TarjetaBankLogo({ banco, size = 32 }) {
  const key = banco?.toLowerCase() || '';
  const initials = BANK_INITIALS[key] || (banco ? banco.slice(0, 2).toUpperCase() : '?');

  return (
    <div style={{
      width: size, height: size, borderRadius: size / 4,
      background: 'rgba(255,255,255,0.2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, color: '#fff',
      letterSpacing: '-0.5px',
    }}>
      {initials}
    </div>
  );
}
