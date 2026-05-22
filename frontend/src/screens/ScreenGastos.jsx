import React, { useMemo, useState } from 'react';
import { C, s } from '../theme.js';
import { dateToMonthId, sortMonthIdsDesc, pctChange, fmtARS, monthIdLabel } from '../utils/format.js';
import { useHideAmounts } from '../HideAmountsContext.jsx';
import DonutChart from '../components/DonutChart.jsx';
import FAB from '../components/FAB.jsx';
import Modal from '../components/Modal.jsx';
import TxForm from '../components/TxForm.jsx';
import TxRow from '../components/TxRow.jsx';
import Divider from '../components/Divider.jsx';
import CuotaDetailModal from '../components/CuotaDetailModal.jsx';
import { createTransaction, updateTransaction, deleteTransaction } from '../api/transactions.js';

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
  const [editTx, setEditTx] = useState(null);
  const [cuotaTx, setCuotaTx] = useState(null);

  const sorted = useMemo(() => sortMonthIdsDesc(allMonthIds), [allMonthIds]);
  const monthTxs = useMemo(() => txs.filter(t => dateToMonthId(t.date) === monthId && t.type === 'g' && t.cat_kind !== 'inversion'), [txs, monthId]);

  const prevMonthId = useMemo(() => {
    const idx = sorted.indexOf(monthId);
    return sorted[idx + 1] || null;
  }, [sorted, monthId]);

  const prevTotal = useMemo(() =>
    prevMonthId ? txs.filter(t => dateToMonthId(t.date) === prevMonthId && t.type === 'g' && t.cat_kind !== 'inversion').reduce((s, t) => s + t.amount, 0) : 0,
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

  const sortedTxs = useMemo(() =>
    [...monthTxs].sort((a, b) => b.date.localeCompare(a.date)),
    [monthTxs]);

  const grouped = useMemo(() => {
    const byDate = {};
    sortedTxs.forEach(t => {
      byDate[t.date] = byDate[t.date] || [];
      byDate[t.date].push(t);
    });
    return Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0]));
  }, [sortedTxs]);

  const handleSave = async (data, cuotas = 1) => {
    if (editTx) {
      await updateTransaction(editTx.id, data);
    } else {
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
    }
    setModalOpen(false);
    setEditTx(null);
    await onTxsChange();
  };

  const handleDelete = async () => {
    if (!editTx) return;
    if (!window.confirm('¿Eliminar movimiento?')) return;
    await deleteTransaction(editTx.id);
    setModalOpen(false);
    setEditTx(null);
    await onTxsChange();
  };

  const handleRowClick = (tx) => {
    if (tx.cuota_total && tx.cuota_total > 1) {
      setCuotaTx(tx);
    } else {
      setEditTx(tx);
      setModalOpen(true);
    }
  };

  const { hidden } = useHideAmounts();
  const hoveredCatName = hoveredIdx !== null ? bycat[hoveredIdx]?.name : null;

  const renderCenter = () => {
    if (hoveredIdx !== null && bycat[hoveredIdx]) {
      const item = bycat[hoveredIdx];
      const pctOf = total > 0 ? (item.value / total) * 100 : 0;
      return (
        <div style={{ textAlign: 'center', maxWidth: 130 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 3 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
            <span style={{ fontSize: 11, color: C.text2, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>
              {item.name}
            </span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 1 }}>
            {hidden ? '••••' : fmtARS(item.value)}
          </div>
          <div style={{ fontSize: 12, color: C.text3, fontWeight: 600 }}>
            {pctOf.toFixed(1)}%
          </div>
        </div>
      );
    }
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 10, color: C.text3, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.06em' }}>Total</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{hidden ? '••••' : fmtARS(total)}</div>
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
        <div style={{ fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>{hidden ? '••••' : fmtARS(total)}</div>
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

      {grouped.length > 0 && (
        <>
          <div style={{
            fontSize: 11, fontWeight: 600, color: C.text3,
            textTransform: 'uppercase', letterSpacing: '.06em',
            margin: '24px 4px 10px',
          }}>
            Movimientos del mes
          </div>
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
            padding: '4px 14px',
          }}>
            {grouped.map(([date, dayTxs], gi) => (
              <React.Fragment key={date}>
                {gi > 0 && <Divider />}
                <div style={{
                  fontSize: 10, fontWeight: 600, color: C.text3,
                  textTransform: 'uppercase', letterSpacing: '.06em',
                  padding: '10px 0 4px',
                }}>
                  {new Date(date + 'T12:00:00').toLocaleDateString('es-AR', {
                    weekday: 'short', day: 'numeric', month: 'short',
                  })}
                </div>
                {dayTxs.map(tx => {
                  const isDimmed = hoveredCatName !== null && tx.cat !== hoveredCatName;
                  return (
                    <div key={tx.id} style={{ opacity: isDimmed ? 0.35 : 1, transition: 'opacity .15s' }}>
                      <TxRow
                        tx={tx}
                        cats={cats}
                        onClick={handleRowClick}
                      />
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </>
      )}

      <div style={{ height: 80 }} />

      <FAB onClick={() => { setEditTx(null); setModalOpen(true); }} />
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditTx(null); }} title={editTx ? 'Editar gasto' : 'Nuevo gasto'}>
        <TxForm
          cats={cats} mediums={mediums}
          initial={editTx || { type: 'g' }}
          onSave={handleSave}
          onCancel={() => { setModalOpen(false); setEditTx(null); }}
          onDelete={handleDelete}
        />
      </Modal>
      <CuotaDetailModal open={!!cuotaTx} tx={cuotaTx} allTxs={txs} onClose={() => setCuotaTx(null)} />
    </div>
  );
}
