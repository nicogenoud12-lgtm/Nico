import React from 'react';

// Íconos de interfaz (trazo 1.75, estilo Lucide). Heredan el color vía currentColor.
function Svg({ size = 18, children, strokeWidth = 1.75, ...rest }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" {...rest}
    >
      {children}
    </svg>
  );
}

export const ChevronLeft = (p) => <Svg {...p}><path d="m15 18-6-6 6-6" /></Svg>;
export const ChevronRight = (p) => <Svg {...p}><path d="m9 18 6-6-6-6" /></Svg>;
export const Plus = (p) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const X = (p) => <Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>;
export const Menu = (p) => <Svg {...p}><path d="M4 7h16M4 12h16M4 17h10" /></Svg>;

export const Eye = (p) => (
  <Svg {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const EyeOff = (p) => (
  <Svg {...p}>
    <path d="M10.7 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.4 3.4M6.6 6.6A17.4 17.4 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="m2 2 20 20" />
  </Svg>
);

// Marca de la app: cuadrado redondeado con el acento y un "$" dibujado.
export function LogoMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b8aff" />
          <stop offset="1" stopColor="#5b5ae6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#logo-g)" />
      <path
        d="M19.5 11.5c-.6-1.2-1.9-2-3.5-2-2 0-3.5 1.1-3.5 2.8 0 3.9 7.2 2.3 7.2 6.2 0 1.8-1.6 3-3.7 3-1.7 0-3.1-.8-3.7-2.1M16 7.5v2M16 21.5v2"
        fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"
      />
    </svg>
  );
}
