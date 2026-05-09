import React, { useState } from 'react';

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

export default function TarjetaBankLogo({ banco, logoUrl, size = 32 }) {
  const [imgError, setImgError] = useState(false);
  const key = banco?.toLowerCase() || '';
  const initials = BANK_INITIALS[key] || (banco ? banco.slice(0, 2).toUpperCase() : '?');
  const showImg = logoUrl && !imgError;

  return (
    <div style={{
      width: size, height: size, borderRadius: size / 4,
      background: showImg ? '#fff' : 'rgba(255,255,255,0.2)',
      overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, color: '#fff',
      letterSpacing: '-0.5px',
    }}>
      {showImg ? (
        <img
          src={logoUrl}
          alt={banco || 'logo'}
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      ) : initials}
    </div>
  );
}
