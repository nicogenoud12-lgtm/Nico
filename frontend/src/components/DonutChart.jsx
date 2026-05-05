import React, { useState } from 'react';
import { C } from '../theme.js';

export default function DonutChart({ data, size = 160, thickness = 28, center }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const pad = 6;
  const inner = size - pad * 2;
  const r = (inner - thickness) / 2;
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
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', overflow: 'visible' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.surface2} strokeWidth={thickness} />
      {slices.map((s, i) => {
        const isHovered = hoveredIdx === i;
        const isDimmed = hoveredIdx !== null && !isHovered;
        return (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={isHovered ? thickness + 5 : thickness}
            strokeDasharray={`${s.len} ${circ - s.len}`}
            strokeDashoffset={-s.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            opacity={isDimmed ? 0.35 : 1}
            style={{ transition: 'stroke-width .15s, opacity .15s', cursor: 'pointer' }}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          />
        );
      })}
      {center && (
        <text
          x={cx} y={cy}
          textAnchor="middle" dominantBaseline="middle"
          fill={hoveredIdx !== null ? slices[hoveredIdx]?.color : C.text}
          fontSize={12} fontWeight={600} fontFamily="Inter, sans-serif"
          style={{ transition: 'fill .15s' }}
        >
          {hoveredIdx !== null ? `${Math.round(slices[hoveredIdx].value / total * 100)}%` : center}
        </text>
      )}
    </svg>
  );
}
