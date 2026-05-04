import React from 'react';

export default function Dot({ color, size = 10 }) {
  return (
    <div style={{
      width: size, height: size,
      borderRadius: '50%',
      background: color,
      flexShrink: 0,
    }} />
  );
}
