import React from 'react';
import { C } from '../theme.js';

export default function DonutChart({ data, size = 160, thickness = 28, center }) {
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  let offset = 0;
  const slices = data.map(d => {
    const pct = d.value / total;
    const len = pct * circ;
    const slice = { ...d, offset, len };
    offset += len;
    return slice;
  });

  const cx = size / 2;
  const cy = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.surface2} strokeWidth={thickness} />
      {slices.map((s, i) => (
        <circle
          key={i}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={s.color}
          strokeWidth={thickness}
          strokeDasharray={`${s.len} ${circ - s.len}`}
          strokeDashoffset={-s.offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray .4s' }}
        />
      ))}
      {center && (
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill={C.text} fontSize={12} fontWeight={600} fontFamily="Inter, sans-serif">
          {center}
        </text>
      )}
    </svg>
  );
}
