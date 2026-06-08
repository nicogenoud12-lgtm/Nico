import React from 'react';
import { C } from '../theme.js';
import { fmtARS } from '../utils/format.js';

export default function SparkBar({ data, color = C.accent, onSelect }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 68 }}>
      {data.map((d, i) => (
        <div
          key={i}
          onClick={() => onSelect && onSelect(d.id)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            cursor: onSelect ? 'pointer' : 'default',
            paddingTop: 4,
          }}
        >
          <div
            title={fmtARS(d.value)}
            style={{
              width: '100%', borderRadius: 3,
              background: d.active ? color : C.surface2,
              height: `${Math.max(4, (d.value / max) * 48)}px`,
              transition: 'background .15s, height .3s',
            }}
          />
          <span style={{
            fontSize: 9,
            color: d.active ? color : C.text3,
            fontWeight: d.active ? 700 : 400,
            transition: 'color .15s',
          }}>
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}
