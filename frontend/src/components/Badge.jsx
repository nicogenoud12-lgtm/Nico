import React from 'react';
import { C } from '../theme.js';

export default function Badge({ children, color = C.text2, bg }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      fontSize: 11, fontWeight: 600,
      color, background: bg || 'transparent',
      padding: bg ? '2px 6px' : 0,
      borderRadius: 4,
    }}>
      {children}
    </span>
  );
}
