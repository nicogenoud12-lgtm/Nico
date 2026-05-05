import React, { useMemo, useState } from 'react';
import { C } from '../theme.js';
import { dateToMonthId, monthIdShort, sortMonthIdsDesc, fmtARS } from '../utils/format.js';

export default function ScreenAnual({ txs, allMonthIds, monthId, setMonthId, onNavigate }) {
  const [hoveredBar, setHoveredBar] = useState(null);
  const sorted = useMemo(() => sortMonthIdsDesc(allMonthIds).slice(0, 12).reverse(), [allMonthIds]);

  const data = useMemo(() => sorted.map(id => {
    const monthTxs = txs.filter(t => dateToMonthId(t.date) === id);
    const ing = monthTxs.filter(t => t.type === 'i').reduce((s, t) => s + t.amount, 0);
    const gas = monthTxs.filter(t => t.type === 'g').reduce((s, t) => s + t.amount, 0);
    return { id, ing, gas, net: ing - gas };
  }), [txs, sorted]);

  const maxVal = Math.max(...data.flatMap(d => [d.ing, d.gas]), 1);

  const currentYear = monthId ? `20${monthId.slice(2)}` : '';

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '16px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 16 }}>
        Últimos 12 meses
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 200, marginBottom: 8 }}>
        {data.map(d => {
          const ingH = Math.max(4, (d.ing / maxVal) * 180);
          const gasH = Math.max(4, (d.gas / maxVal) * 180);
          const isActive = d.id === monthId;

          const isHovered = hoveredBar === d.id;
          return (
            <div
              key={d.id}
              onClick={() => { setMonthId(d.id); onNavigate?.('movimientos'); }}
              onMouseEnter={() => setHoveredBar(d.id)}
              onMouseLeave={() => setHoveredBar(null)}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', borderRadius: 4, transition: 'background .15s', background: isHovered && !isActive ? C.surface2 : 'transparent' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 180 }}>
                <div style={{
                  width: '100%', borderRadius: '3px 3px 0 0',
                  background: isActive || isHovered ? C.green : C.green + '55',
                  height: ingH, transition: 'height .3s, background .15s',
                  minWidth: 6,
                }} />
                <div style={{
                  width: '100%', borderRadius: '3px 3px 0 0',
                  background: isActive || isHovered ? C.red : C.red + '55',
                  height: gasH, transition: 'height .3s, background .15s',
                  minWidth: 6,
                }} />
              </div>
              <span style={{
                fontSize: 9, color: isActive || isHovered ? C.text : C.text3,
                fontWeight: isActive ? 700 : 400,
                transition: 'color .15s',
              }}>
                {monthIdShort(d.id)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: C.green }} />
          <span style={{ fontSize: 12, color: C.text2 }}>Ingresos</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: C.red }} />
          <span style={{ fontSize: 12, color: C.text2 }}>Gastos</span>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '10px 16px', borderBottom: `1px solid ${C.border}` }}>
          {['Mes', 'Ingresos', 'Gastos', 'Neto'].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</span>
          ))}
        </div>
        {[...data].reverse().map((d, i, arr) => (
          <div
            key={d.id}
            onClick={() => setMonthId(d.id)}
            onMouseEnter={() => setHoveredBar(d.id)}
            onMouseLeave={() => setHoveredBar(null)}
            style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
              padding: '11px 16px',
              borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none',
              background: d.id === monthId ? C.surface2 : hoveredBar === d.id ? C.surface2 + 'aa' : 'transparent',
              cursor: 'pointer',
              transition: 'background .15s',
            }}
          >
            <span style={{ fontSize: 13, color: C.text, fontWeight: d.id === monthId ? 600 : 400 }}>
              {monthIdShort(d.id)} {`'${d.id.slice(2)}`}
            </span>
            <span style={{ fontSize: 13, color: C.green }}>{fmtARS(d.ing)}</span>
            <span style={{ fontSize: 13, color: C.red }}>{fmtARS(d.gas)}</span>
            <span style={{ fontSize: 13, color: d.net >= 0 ? C.green : C.red, fontWeight: 600 }}>{fmtARS(d.net)}</span>
          </div>
        ))}
      </div>

      <div style={{ height: 40 }} />
    </div>
  );
}
