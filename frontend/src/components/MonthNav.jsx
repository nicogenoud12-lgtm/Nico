import React from 'react';
import { C } from '../theme.js';
import { MONTH_NAMES } from '../utils/format.js';
import { ChevronLeft, ChevronRight } from './Icons.jsx';

// Selector de mes: título grande "Septiembre 2026" + flechas. El <select> nativo
// queda invisible encima del título, así tocarlo abre el picker del sistema.
// `sorted` viene en orden descendente (más nuevo primero).
export default function MonthNav({ monthId, sorted, setMonthId, size = 'lg', style }) {
  const i = sorted.indexOf(monthId);
  const hasPrev = i < sorted.length - 1;
  const hasNext = i > 0;
  const mm = parseInt(monthId.slice(0, 2), 10) - 1;
  const yy = '20' + monthId.slice(2);

  const arrow = (enabled, onClick, Icon, label) => (
    <button
      onClick={onClick} disabled={!enabled} aria-label={label}
      style={{
        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: C.surface, border: `1px solid ${C.border}`, boxShadow: C.elev,
        color: enabled ? C.text2 : C.border2,
        cursor: enabled ? 'pointer' : 'default',
      }}
    >
      <Icon size={16} />
    </button>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, ...style }}>
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: size === 'lg' ? 22 : 18, fontWeight: 650, color: C.text,
          letterSpacing: '-0.02em', whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'baseline', gap: 6,
        }}>
          {MONTH_NAMES[mm]}
          <span style={{ color: C.text3, fontWeight: 500 }}>{yy}</span>
          <ChevronRight size={14} strokeWidth={2.25} style={{ color: C.text3, transform: 'rotate(90deg)', alignSelf: 'center' }} />
        </div>
        <select
          value={monthId}
          onChange={e => setMonthId(e.target.value)}
          aria-label="Elegir mes"
          style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', cursor: 'pointer' }}
        >
          {sorted.map(id => (
            <option key={id} value={id}>{MONTH_NAMES[parseInt(id.slice(0, 2), 10) - 1]} 20{id.slice(2)}</option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {arrow(hasPrev, () => hasPrev && setMonthId(sorted[i + 1]), ChevronLeft, 'Mes anterior')}
        {arrow(hasNext, () => hasNext && setMonthId(sorted[i - 1]), ChevronRight, 'Mes siguiente')}
      </div>
    </div>
  );
}
