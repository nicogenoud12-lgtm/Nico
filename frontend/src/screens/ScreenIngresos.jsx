import React, { useMemo } from 'react';
import { C } from '../theme.js';
import { dateToMonthId, sortMonthIdsDesc, pctChange, fmtARS, monthIdLabel } from '../utils/format.js';
import DonutChart from '../components/DonutChart.jsx';
import Divider from '../components/Divider.jsx';
import Dot from '../components/Dot.jsx';

function PctBadge({ pct }) {
  if (pct === null || pct === undefined) return <span style={{ fontSize: 11, color: C.text3 }}>—</span>;
  const isGood = pct > 0;
  const color = isGood ? C.green : C.red;
  const arrow = pct > 0 ? '↑' : '↓';
  return (
    <span style={{ fontSize: 11, color, fontWeight: 600 }}>
      {arrow} {Math.abs(pct)}% vs mes ant.
    </span>
  );
}

export default function ScreenIngresos({ txs, cats, monthId, allMonthIds }) {
  const monthTxs = useMemo(() => txs.filter(t => dateToMonthId(t.date) === monthId && t.type === 'i'), [txs, monthId]);

  const prevMonthId = useMemo(() => {
    const sorted = sortMonthIdsDesc(allMonthIds);
    const idx = sorted.indexOf(monthId);
    return sorted[idx + 1] || null;
  }, [allMonthIds, monthId]);

  const prevTotal = useMemo(() =>
    prevMonthId ? txs.filter(t => dateToMonthId(t.date) === prevMonthId && t.type === 'i').reduce((s, t) => s + t.amount, 0) : 0,
    [txs, prevMonthId]);

  const total = monthTxs.reduce((s, t) => s + t.amount, 0);
  const pct = pctChange(total, prevTotal);

  const bycat = useMemo(() => {
    const map = {};
    monthTxs.forEach(t => {
      map[t.cat] = (map[t.cat] || 0) + t.amount;
    });
    return Object.entries(map)
      .map(([name, value]) => {
        const cat = cats.ingresos.find(c => c.name === name);
        return { name, value, color: cat?.color || C.green };
      })
      .sort((a, b) => b.value - a.value);
  }, [monthTxs, cats]);

  const donutData = bycat.length > 0 ? bycat : [{ name: 'Sin datos', value: 1, color: C.surface2 }];

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '16px' }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: C.text3, marginBottom: 4 }}>{monthIdLabel(monthId)}</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: C.green, marginBottom: 4 }}>{fmtARS(total)}</div>
        <PctBadge pct={pct} />
      </div>

      {bycat.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <DonutChart data={donutData} size={200} thickness={32} center={`${bycat.length} cat.`} />
        </div>
      )}

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {bycat.map((item, i) => (
          <React.Fragment key={item.name}>
            {i > 0 && <Divider my={0} />}
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <Dot color={item.color} size={12} />
              <span style={{ flex: 1, fontSize: 14, color: C.text }}>{item.name}</span>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.green }}>{fmtARS(item.value)}</div>
                <div style={{ fontSize: 11, color: C.text3 }}>{total > 0 ? Math.round(item.value / total * 100) : 0}%</div>
              </div>
            </div>
          </React.Fragment>
        ))}
        {bycat.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', color: C.text3, fontSize: 14 }}>Sin ingresos este mes</div>
        )}
      </div>

      <div style={{ height: 40 }} />
    </div>
  );
}
