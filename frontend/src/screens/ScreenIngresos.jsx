import React, { useMemo, useState } from 'react';
import { C, s } from '../theme.js';
import { dateToMonthId, sortMonthIdsDesc, pctChange, fmtARS, monthIdLabel, fmtARSInt } from '../utils/format.js';
import { useHideAmounts } from '../HideAmountsContext.jsx';
import DonutChart from '../components/DonutChart.jsx';
import FAB from '../components/FAB.jsx';
import Modal from '../components/Modal.jsx';
import TxForm from '../components/TxForm.jsx';
import TxRow from '../components/TxRow.jsx';
import Divider from '../components/Divider.jsx';
import MonthNav from '../components/MonthNav.jsx';
import { createTransaction, updateTransaction, deleteTransaction } from '../api/transactions.js';

function PctBadge({ pct }) {
  if (pct === null || pct === undefined) return <span style={{ fontSize: 12, color: C.text3 }}>Sin datos del mes anterior</span>;
  const isGood = pct > 0;
  const color = isGood ? C.green : C.red;
  const arrow = pct > 0 ? '↑' : '↓';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, color, background: color + '1a', padding: '2px 7px', borderRadius: 6 }}>
        {arrow} {Math.abs(pct)}%
      </span>
      <span style={{ fontSize: 12, color: C.text3 }}>vs mes anterior</span>
    </span>
  );
}

export default function ScreenIngresos({ txs, cats, mediums, monthId, allMonthIds, setMonthId, onTxsChange }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [selectedCat, setSelectedCat] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTx, setEditTx] = useState(null);

  const sorted = useMemo(() => sortMonthIdsDesc(allMonthIds), [allMonthIds]);

  React.useEffect(() => { setSelectedCat(null); }, [monthId]);

  // Pantalla en pesos: se excluyen las transacciones en USD (viven en el baúl de Dólares).
  const monthTxs = useMemo(() => txs.filter(t => dateToMonthId(t.date) === monthId && t.type === 'i' && t.currency !== 'USD'), [txs, monthId]);

  const prevMonthId = useMemo(() => {
    const idx = sorted.indexOf(monthId);
    return sorted[idx + 1] || null;
  }, [sorted, monthId]);

  const prevTotal = useMemo(() =>
    prevMonthId ? txs.filter(t => dateToMonthId(t.date) === prevMonthId && t.type === 'i' && t.currency !== 'USD').reduce((s, t) => s + t.amount, 0) : 0,
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

  const sortedTxs = useMemo(() =>
    [...monthTxs].sort((a, b) => b.date.localeCompare(a.date)),
    [monthTxs]);

  const grouped = useMemo(() => {
    const base = selectedCat ? sortedTxs.filter(t => t.cat === selectedCat) : sortedTxs;
    const byDate = {};
    base.forEach(t => {
      byDate[t.date] = byDate[t.date] || [];
      byDate[t.date].push(t);
    });
    return Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0]));
  }, [sortedTxs, selectedCat]);

  const selectedIdx = selectedCat !== null ? bycat.findIndex(c => c.name === selectedCat) : null;

  const handleSelectCat = (idx) => {
    const name = bycat[idx]?.name;
    setSelectedCat(prev => prev === name ? null : name);
    setHoveredIdx(null);
  };

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
    setEditTx(tx);
    setModalOpen(true);
  };

  const { hidden } = useHideAmounts();
  const renderCenter = () => {
    const activeItem = hoveredIdx !== null ? bycat[hoveredIdx] : (selectedCat ? bycat.find(c => c.name === selectedCat) : null);
    if (activeItem) {
      const pctOf = total > 0 ? (activeItem.value / total) * 100 : 0;
      return (
        <div style={{ textAlign: 'center', maxWidth: 130 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 3 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: activeItem.color }} />
            <span style={{ fontSize: 11, color: C.text2, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>
              {activeItem.name}
            </span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 1 }}>
            {hidden ? '••••' : fmtARS(activeItem.value)}
          </div>
          <div style={{ fontSize: 12, color: C.text3, fontWeight: 600 }}>
            {pctOf.toFixed(1)}%
          </div>
        </div>
      );
    }
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: C.text3, marginBottom: 2 }}>Total</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.green }}>{hidden ? '••••' : fmtARS(total)}</div>
      </div>
    );
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
    <div style={{ padding: 'clamp(16px, 3.5vw, 32px) clamp(16px, 3.5vw, 32px) 0', maxWidth: 1080, margin: '0 auto' }}>
      <MonthNav monthId={monthId} sorted={sorted} setMonthId={setMonthId} style={{ marginBottom: 22 }} />

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.text3, marginBottom: 4 }}>Total ingresado</div>
        <div style={{ fontSize: 34, fontWeight: 650, letterSpacing: '-0.03em', color: C.green, marginBottom: 8 }}>{hidden ? '••••' : fmtARS(total)}</div>
        <PctBadge pct={pct} />
      </div>

      {bycat.length > 0 ? (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16,
          padding: 'clamp(18px, 3vw, 28px)',
          display: 'flex', alignItems: 'center', gap: 'clamp(20px, 4vw, 40px)', flexWrap: 'wrap', justifyContent: 'center',
        }}>
          <DonutChart
            data={bycat}
            size={196}
            thickness={22}
            hoveredIdx={hoveredIdx}
            onHover={setHoveredIdx}
            selectedIdx={selectedIdx}
            onClickSlice={handleSelectCat}
            renderCenter={renderCenter}
          />
          <div style={{ flex: 1, minWidth: 200, maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {bycat.map((item, i) => {
              const pctOf = total > 0 ? (item.value / total) * 100 : 0;
              const isHovered = hoveredIdx === i;
              const isSelected = selectedCat === item.name;
              const isDimmed = selectedCat !== null ? !isSelected : (hoveredIdx !== null && !isHovered);
              return (
                <div
                  key={item.name}
                  onMouseEnter={() => !selectedCat && setHoveredIdx(i)}
                  onMouseLeave={() => !selectedCat && setHoveredIdx(null)}
                  onClick={() => handleSelectCat(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 9,
                    background: isSelected || isHovered ? C.surface2 : 'transparent',
                    opacity: isDimmed ? 0.3 : 1,
                    transition: 'background .15s, opacity .2s',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: 3, background: item.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: isSelected ? 600 : 400 }}>
                    {item.name}
                  </span>
                  <span style={{ fontSize: 13, color: C.text, fontWeight: 550, flexShrink: 0 }}>
                    {hidden ? '••••' : fmtARSInt(item.value)}
                  </span>
                  <span style={{ fontSize: 12, color: C.text3, fontWeight: 500, flexShrink: 0, width: 44, textAlign: 'right' }}>
                    {pctOf.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{
          background: C.surface, border: `1px dashed ${C.border2}`, borderRadius: 16,
          padding: '40px', textAlign: 'center', color: C.text3, fontSize: 14,
        }}>
          Sin ingresos este mes
        </div>
      )}

      {grouped.length > 0 && (
        <>
          <div style={{
            fontSize: 14, fontWeight: 600, color: C.text,
            margin: '32px 2px 10px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {selectedCat ? (
              <>
                <span>{selectedCat}</span>
                <button
                  onClick={() => setSelectedCat(null)}
                  style={{ background: C.surface2, border: 'none', borderRadius: 4, color: C.text3, fontSize: 10, fontWeight: 700, padding: '2px 6px', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  ✕ Todos
                </button>
              </>
            ) : 'Movimientos del mes'}
          </div>
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16,
            padding: '6px 16px 10px',
          }}>
            {grouped.map(([date, dayTxs], gi) => (
              <React.Fragment key={date}>
                
                <div style={{
                  fontSize: 12.5, fontWeight: 500, color: C.text3,
                  padding: '12px 0 4px',
                }}>
                  {(d => d.charAt(0).toUpperCase() + d.slice(1))(new Date(date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }))}
                </div>
                {dayTxs.map(tx => (
                  <TxRow key={tx.id} tx={tx} cats={cats} onClick={handleRowClick} showDate={false} />
                ))}
              </React.Fragment>
            ))}
          </div>
        </>
      )}

      <div style={{ height: 80 }} />

      <FAB onClick={() => { setEditTx(null); setModalOpen(true); }} />
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditTx(null); }} title={editTx ? 'Editar ingreso' : 'Nuevo ingreso'}>
        <TxForm
          cats={cats} mediums={mediums}
          initial={editTx || { type: 'i' }}
          onSave={handleSave}
          onCancel={() => { setModalOpen(false); setEditTx(null); }}
          onDelete={handleDelete}
        />
      </Modal>
    </div>
    </div>
  );
}
