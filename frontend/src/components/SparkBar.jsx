import React from 'react';
import { C } from '../theme.js';
import { fmtARS } from '../utils/format.js';

export default function SparkBar({ data, color = C.accent }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div
            title={fmtARS(d.value)}
            style={{
              width: '100%', borderRadius: 3,
              background: d.active ? color : C.surface2,
              height: `${Math.max(4, (d.value / max) * 48)}px`,
              transition: 'height .3s',
            }}
          />
          <span style={{ fontSize: 9, color: C.text3 }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}
