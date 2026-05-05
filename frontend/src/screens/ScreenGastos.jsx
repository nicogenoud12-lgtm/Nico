import React, { useMemo, useState } from 'react';
import { C, s } from '../theme.js';
import { dateToMonthId, sortMonthIdsDesc, pctChange, fmtARS, monthIdLabel } from '../utils/format.js';
import DonutChart from '../components/DonutChart.jsx';
import FAB from '../components/FAB.jsx';
import Modal from '../components/Modal.jsx';
import TxForm from '../components/TxForm.jsx';
import { createTransaction } from '../api/transactions.js';

function PctBadge({ pct }) {
  if (pct === null || pct === undefined) return <span style={{ fontSize: 11, color: C.text3 }}>—</span>;
  const isGood = pct < 0;
  const color = isGood ? C.green : C.red;
  const arrow = pct > 0 ? '↑' : '↓';
  return (
    <span style={{ fontSize: 11, color, fontWeight: 600 }}>
      {arrow} {Math.abs(pct)}% vs mes ant.
    </span>
  );
}

export default function ScreenGastos({ txs, cats, mediums, monthId, allMonthIds, setMonthId, onTxsChange }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const sorted = useMemo(() => sortMonthIdsDesc(allMonthIds), [allMonthIds]);
  const monthTxs = useMemo(() => txs.filter(t => dateToMonthId(t.date) === monthId && t.type === 'g'), [txs, monthId]);

  const prevMonthId = useMemo(() => {
    const idx = sorted.indexOf(monthId);
    return sorted[idx + 1] || null;
  }, [sorted, monthId]);

  const prevTotal = useMemo(() =>
    prevMonthId ? txs.filter(t => dateToMonthId(t.date) === prevMonthId && t.type === 'g').reduce((s, t) => s + t.amount, 0) : 0,
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
        const cat = cats.gastos.find(c => c.name === name);
        return { name, value, color: cat?.color || C.text3 };
      })
      .sort((a, b) => b.value - a.value);
  }, [monthTxs, cats]);

  const handleSave = async (data, cuotas = 1) => {
    const baseDate = new Date(data.date + 'T12:00:00');
    for (let i = 0; i < cuotas; i++) {
      const d = new Date(baseDate);
      d.setMonth(d.getMonth() + i);
      const ds = d.toISOString().slice(0, 10);
      await createTransaction({
        ...data,
        amount: data.amount / cuotas,
        date: ds,
        cuota_num: cuotas > 1 ? i + 1 : null,
        cuota_total: cuotas > 1 ? cuotas : null,
      });
    }
    setModalOpen(false);
    await onTxsChange();
  };

  const displayIdx = hoveredIdx !== null ? hoveredIdx : (bycat.length > 0 ? 0 : null);
  const displayItem = displayIdx !== null ? bycat[displayIdx] : null;

  const renderCenter = () => {
    if (!displayItem) return null;
    const pctOf = total > 0 ? (displayItem.value / total) * 100 : 0;
    return (
      <div style={{ textAlign: 'center', maxWidth: 130 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: displayItem.color }} />
          <span style={{ fontSize: 11, color: C.text2, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>
            {displayItem.name}
          </span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 1 }}>
          {fmtARS(displayItem.value)}
        </div>
        <div style={{ fontSize: 12, color: C.text3, fontWeight: 600 }}>
          {pctOf.toFixed(1)}%
        </div>
      </div>
    );
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '16px' }}>
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <button
          onClick={() => { const i = sorted.indexOf(monthId); if (i < sorted.length - 1) setMonthId(sorted[i + 1]); }}
          style={{ ...s.btnIcon, fontSize: 18 }}
        >‹</button>
        <select
          value={monthId}
          onChange={e => setMonthId(e.target.value)}
          style={{ ...s.select, width: 'auto', flex: 1, fontSize: 15, fontWeight: 600 }}
        >
          {sorted.map(id => <option key={id} value={id}>{monthIdLabel(id)}</option>)}
        </select>
        <button
          onClick={() => { const i = sorted.indexOf(monthId); if (i > 0) setMonthId(sorted[i - 1]); }}
          style={{ ...s.btnIcon, fontSize: 18 }}
        >›</button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>{fmtARS(total)}</div>
        <PctBadge pct={pct} />
      </div>

      {bycat.length > 0 ? (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
          padding: '20px 16px',
          display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', justifyContent: 'center',
        }}>
          <DonutChart
            data={bycat}
            size={200}
            thickness={32}
            hoveredIdx={hoveredIdx}
            onHover={setHoveredIdx}
            renderCenter={renderCenter}
          />
          <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {bycat.map((item, i) => {
              const pctOf = total > 0 ? (item.value / total) * 100 : 0;
              const isHovered = hoveredIdx === i;
              const isDimmed = hoveredIdx !== null && !isHovered;
              return (
                <div
                  key={item.name}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 10px', borderRadius: 7,
                    background: isHovered ? C.surface2 : 'transparent',
                    opacity: isDimmed ? 0.4 : 1,
                    transition: 'background .15s, opacity .15s',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.name}
                  </span>
                  <span style={{ fontSize: 13, color: C.text2, fontWeight: 600, flexShrink: 0 }}>
                    {pctOf.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
          padding: '32px', textAlign: 'center', color: C.text3, fontSize: 14,
        }}>
          Sin gastos este mes
        </div>
      )}

      <div style={{ height: 80 }} />

      <FAB onClick={() => setModalOpen(true)} />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo gasto">
        <TxForm
          cats={cats} mediums={mediums}
          initial={{ type: 'g' }}
          onSave={handleSave}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
