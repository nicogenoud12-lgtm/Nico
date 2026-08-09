import React from 'react';

// Mapeo: nombre de categoría (lowercase) → filename en /public/icons/cat/
const CAT_ICON_MAP = {
  'comida': 'comida',
  'combustible': 'combustible',
  'ocio': 'ocio',
  'salud': 'salud',
  'recurrentes': 'recurrentes',
  'ropa': 'ropa',
  'viajes': 'viajes',
  'gimnasio': 'gimnasio',
  'regalo': 'regalo',
  'donación': 'donacion',
  'donacion': 'donacion',
  'art. higiene': 'art-higiene',
  'artículos de higiene': 'art-higiene',
  'impuestos': 'impuestos',
  'impuestos tarjetas': 'impuestos-tarjetas',
  'impuestos tarjeta': 'impuestos-tarjetas',
  'transporte': 'transporte',
  'sueldo': 'sueldo',
  'suplementos': 'suplementos',
  'peluquería': 'peluqueria',
  'peluqueria': 'peluqueria',
  'otros': 'otros',
  'suscripciones': 'suscripciones',
  'tarjeta': 'tarjeta',
  'pc': 'pc',
  'veterinaria': 'veterinaria',
  'dólar': 'dolar',
  'dolar': 'dolar',
  'inversiones': 'dolar',
  'muebles': 'muebles',
  'compras': 'muebles',
  'muebles fábrica': 'muebles',
  'muebles fabrica': 'muebles',
  // ingresos
  'fábrica': 'fabrica',
  'fabrica': 'fabrica',
  'aerosilla': 'aerosilla',
  'ventas muebles': 'muebles',
  'venta muebles': 'muebles',
  'otro': 'otro',
};

export default function CatIconBadge({ cat, color, size = 36 }) {
  const slug = CAT_ICON_MAP[(cat || '').toLowerCase()];
  const iconSize = Math.round(size * 0.55);

  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.28), flexShrink: 0,
      background: color + '22',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {slug ? (
        <div style={{
          width: iconSize, height: iconSize,
          maskImage: `url(/icons/cat/${slug}.svg)`,
          maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center',
          WebkitMaskImage: `url(/icons/cat/${slug}.svg)`,
          WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center',
          backgroundColor: color,
        }} />
      ) : (
        <div style={{ width: Math.round(size * 0.28), height: Math.round(size * 0.28), borderRadius: '50%', background: color }} />
      )}
    </div>
  );
}
