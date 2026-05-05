import React, { useState } from 'react';
import { C } from '../theme.js';

export default function DonutChart({
  data,
  size = 160,
  thickness = 28,
  center,
  renderCenter,
  hoveredIdx: controlledHover,
  onHover,
}) {
  const [internalHover, setInternalHover] = useState(null);
  const hoveredIdx = controlledHover !== undefined ? controlledHover : internalHover;
  const setHover = onHover || setInternalHover;

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
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', overflow: 'visible' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.surface2} strokeWidth={thickness} />
        {slices.map((s, i) => {
          const isHovered = hoveredIdx === i;
          const isDimmed = hoveredIdx !== null && hoveredIdx !== undefined && !isHovered;
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
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
        {center && !renderCenter && (
          <text
            x={cx} y={cy}
            textAnchor="middle" dominantBaseline="middle"
            fill={hoveredIdx !== null && hoveredIdx !== undefined ? slices[hoveredIdx]?.color : C.text}
            fontSize={12} fontWeight={600} fontFamily="Inter, sans-serif"
            style={{ transition: 'fill .15s' }}
          >
            {hoveredIdx !== null && hoveredIdx !== undefined ? `${Math.round(slices[hoveredIdx].value / total * 100)}%` : center}
          </text>
        )}
      </svg>
      {renderCenter && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          {renderCenter(hoveredIdx, slices, total)}
        </div>
      )}
    </div>
  );
}
