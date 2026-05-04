import React, { useState, useMemo } from 'react';
import { C, s } from '../theme.js';
import { dateToMonthId, monthIdLabel, sortMonthIdsDesc, pctChange, fmtARS, fmtMoney } from '../utils/format.js';
import TxRow from '../components/TxRow.jsx';
import FAB from '../components/FAB.jsx';
import Modal from '../components/Modal.jsx';
import TxForm from '../components/TxForm.jsx';
import Divider from '../components/Divider.jsx';
import { createTransaction, updateTransaction, deleteTransaction } from '../api/transactions.js';

function PctBadge({ pct, inverse = false }) {
  if (pct === null || pct === undefined) return <span style={{ fontSize: 11, color: C.text3 }}>—</span>;
  const isGood = inverse ? pct < 0 : pct > 0;
  const color = isGood ? C.green : C.red;
  const arrow = pct > 0 ? '↑' : '↓';
  return (
    <span style={{ fontSize: 11, color, fontWeight: 600 }}>
      {arrow} {Math.abs(pct)}% vs mes ant.
    </span>
  );
}

export default function ScreenMovimientos({ txs, cats, mediums, monthId, allMonthIds, setMonthId, onTxsChange }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editTx, setEditTx] = useState(null);
  const [filter, setFilter] = useState('all');

  const monthTxs = useMemo(() => txs.filter(t => dateToMonthId(t.date) === monthId), [txs, monthId]);

  const prevMonthId = useMemo(() => {
    const sorted = sortMonthIdsDesc(allMonthIds);
    const idx = sorted.indexOf(monthId);
    return sorted[idx + 1] || null;
  }, [allMonthIds, monthId]);

  const prevTxs = useMemo(() => prevMonthId ? txs.filter(t => dateToMonthId(t.date) === prevMonthId) : [], [txs, prevMonthId]);

  const curIng = monthTxs.filter(t => t.type === 'i').reduce((s, t) => s + t.amount, 0);
  const curGas = monthTxs.filter(t => t.type === 'g').reduce((s, t) => s + t.amount, 0);
  const curNet = curIng - curGas;

  const prevIng = prevTxs.filter(t => t.type === 'i').reduce((s, t) => s + t.amount, 0);
  const prevGas = prevTxs.filter(t => t.type === 'g').reduce((s, t) => s + t.amount, 0);
  const prevNet = prevIng - prevGas;

  const pctIng = pctChange(curIng, prevIng);
  const pctGas = pctChange(curGas, prevGas);
  const pctNet = pctChange(curNet, prevNet);

  const sorted = sortMonthIdsDesc(allMonthIds);

  const filteredTxs = useMemo(() => {
    const base = monthTxs;
    if (filter === 'g') return base.filter(t => t.type === 'g');
    if (filter === 'i') return base.filter(t => t.type === 'i');
    return base;
  }, [monthTxs, filter]);

  const grouped = useMemo(() => {
    const byDate = {};
    [...filteredTxs].sort((a, b) => b.date.localeCompare(a.date)).forEach(t => {
      byDate[t.date] = byDate[t.date] || [];
      byDate[t.date].push(t);
    });
    return Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredTxs]);

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

  const handleDelete = async (tx) => {
    if (!window.confirm('¿Eliminar movimiento?')) return;
    await deleteTransaction(tx.id);
    await onTxsChange();
  };

  const handleEdit = (tx) => {
    setEditTx(tx);
    setModalOpen(true);
  };

  const statCard = (label, value, pct, inverse = false) => (
    <div style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>{fmtARS(value)}</div>
      <PctBadge pct={pct} inverse={inverse} />
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Month selector */}
      <div style={{ padding: '16px 16px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <button
            onClick={() => { const i = sorted.indexOf(monthId); if (i < sorted.length - 1) setMonthId(sorted[i + 1]); }}
            style={{ ...s.btnIcon, fontSize: 18 }}
          >‹</button>
          <select
            value={monthId}
            onChange={e => setMonthId(e.target.value)}
            style={{ ...s.select, width: 'auto', flex: 1, fontSize: 16, fontWeight: 600 }}
          >
            {sorted.map(id => <option key={id} value={id}>{monthIdLabel(id)}</option>)}
          </select>
          <button
            onClick={() => { const i = sorted.indexOf(monthId); if (i > 0) setMonthId(sorted[i - 1]); }}
            style={{ ...s.btnIcon, fontSize: 18 }}
          >›</button>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {statCard('Ingresos', curIng, pctIng, false)}
          {statCard('Gastos', curGas, pctGas, true)}
          {statCard('Neto', curNet, pctNet, false)}
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {[['all', 'Todos'], ['g', 'Gastos'], ['i', 'Ingresos']].map(([v, l]) => (
            <button
              key={v} onClick={() => setFilter(v)}
              style={{
                padding: '5px 12px', borderRadius: 6, border: 'none', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer',
                background: filter === v ? C.accent : C.surface2,
                color: filter === v ? '#fff' : C.text2,
                fontWeight: filter === v ? 600 : 400,
              }}
            >
              {l}
            </button>
          ))}
        </div>
        <Divider my={0} />
      </div>

      {/* Transaction list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
        {grouped.length === 0 && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: C.text3, fontSize: 14 }}>
            Sin movimientos
          </div>
        )}
        {grouped.map(([date, dayTxs]) => (
          <div key={date}>
            <div style={{
              fontSize: 11, fontWeight: 600, color: C.text3,
              textTransform: 'uppercase', letterSpacing: '.06em',
              padding: '12px 0 4px',
            }}>
              {new Date(date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
            </div>
            {dayTxs.map((tx, i) => (
              <React.Fragment key={tx.id}>
                {i > 0 && <Divider my={0} />}
                <TxRow tx={tx} cats={cats} onEdit={handleEdit} onDelete={handleDelete} />
              </React.Fragment>
            ))}
          </div>
        ))}
        <div style={{ height: 80 }} />
      </div>

      <FAB onClick={() => { setEditTx(null); setModalOpen(true); }} />
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditTx(null); }} title={editTx ? 'Editar movimiento' : 'Nuevo movimiento'}>
        <TxForm
          cats={cats} mediums={mediums}
          initial={editTx}
          onSave={handleSave}
          onCancel={() => { setModalOpen(false); setEditTx(null); }}
        />
      </Modal>
    </div>
  );
}
