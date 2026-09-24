import React, { useState, useMemo, useEffect } from 'react';
import { C, s, blur } from '../theme.js';
import { dateToMonthId, monthIdLabel, sortMonthIdsDesc, pctChange, fmtARS, fmtARSInt, fmtMoney } from '../utils/format.js';
import TxRow from '../components/TxRow.jsx';
import { useHideAmounts } from '../HideAmountsContext.jsx';
import FAB from '../components/FAB.jsx';
import Modal from '../components/Modal.jsx';
import TxForm from '../components/TxForm.jsx';
import MonthNav from '../components/MonthNav.jsx';
import Segmented from '../components/Segmented.jsx';
import CuotaDetailModal from '../components/CuotaDetailModal.jsx';
import { createTransaction, updateTransaction, deleteTransaction } from '../api/transactions.js';

function PctBadge({ pct, inverse = false, compact = false }) {
  if (pct === null || pct === undefined) return <span style={{ fontSize: 11.5, color: C.text3 }}>—</span>;
  const isGood = inverse ? pct < 0 : pct > 0;
  const color = isGood ? C.green : C.red;
  const arrow = pct > 0 ? '↑' : '↓';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
      <span style={{
        fontSize: 11, fontWeight: 600, color,
        background: color + '1a', padding: '2px 6px', borderRadius: 6,
      }}>
        {arrow} {Math.abs(pct)}%
      </span>
      {!compact && <span style={{ fontSize: 11.5, color: C.text3 }}>vs mes anterior</span>}
    </span>
  );
}

function dayLabel(date) {
  const s = new Date(date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function ScreenMovimientos({ txs, cats, mediums, monthId, allMonthIds, setMonthId, onTxsChange }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editTx, setEditTx] = useState(null);
  const [editAllCuotas, setEditAllCuotas] = useState(null);
  const [filter, setFilter] = useState('all');
  const [cuotaTx, setCuotaTx] = useState(null);
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  const { hidden } = useHideAmounts();

  const monthTxs = useMemo(() => txs.filter(t => dateToMonthId(t.date) === monthId), [txs, monthId]);

  const prevMonthId = useMemo(() => {
    const sorted = sortMonthIdsDesc(allMonthIds);
    const idx = sorted.indexOf(monthId);
    return sorted[idx + 1] || null;
  }, [allMonthIds, monthId]);

  const prevTxs = useMemo(() => prevMonthId ? txs.filter(t => dateToMonthId(t.date) === prevMonthId) : [], [txs, prevMonthId]);

  // Los totales en pesos solo suman transacciones en ARS; las USD se muestran
  // en la lista pero no se mezclan en el total (su lugar es el baúl de Dólares).
  const curIng = monthTxs.filter(t => t.type === 'i' && t.currency !== 'USD').reduce((s, t) => s + t.amount, 0);
  const curGas = monthTxs.filter(t => t.type === 'g' && t.cat_kind !== 'inversion' && t.currency !== 'USD').reduce((s, t) => s + t.amount, 0);
  const curNet = curIng - curGas;

  const prevIng = prevTxs.filter(t => t.type === 'i' && t.currency !== 'USD').reduce((s, t) => s + t.amount, 0);
  const prevGas = prevTxs.filter(t => t.type === 'g' && t.cat_kind !== 'inversion' && t.currency !== 'USD').reduce((s, t) => s + t.amount, 0);
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
    if (editTx && editAllCuotas) {
      await Promise.all(editAllCuotas.map(c => updateTransaction(c.id, {
        ...data, date: c.date, cuota_num: c.cuota_num, cuota_total: c.cuota_total,
      })));
    } else if (editTx) {
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
    setEditAllCuotas(null);
    await onTxsChange();
  };

  const handleDelete = async () => {
    if (!editTx) return;
    if (!window.confirm('¿Eliminar movimiento?')) return;
    await deleteTransaction(editTx.id);
    setModalOpen(false);
    setEditTx(null);
    setEditAllCuotas(null);
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

  const handleCuotaEditSingle = (tx) => {
    setCuotaTx(null);
    setEditTx(tx);
    setEditAllCuotas(null);
    setModalOpen(true);
  };

  const handleCuotaEditAll = (tx, cuotas) => {
    setCuotaTx(null);
    setEditTx(tx);
    setEditAllCuotas(cuotas);
    setModalOpen(true);
  };

  const handleCuotaDeleteSingle = async (tx) => {
    if (!window.confirm('¿Eliminar esta cuota?')) return;
    await deleteTransaction(tx.id);
    setCuotaTx(null);
    await onTxsChange();
  };

  const handleCuotaDeleteAll = async (cuotas) => {
    if (!window.confirm(`¿Eliminar las ${cuotas.length} cuotas?`)) return;
    await Promise.all(cuotas.map(c => deleteTransaction(c.id)));
    setCuotaTx(null);
    await onTxsChange();
  };

  // Movimientos permite registrar gastos puros e inversiones desde el mismo FAB.
  // TxForm muestra cats.gastos para type='g'; mergeamos inversiones para que
  // ambas familias aparezcan en el dropdown de categoría.
  const catsForForm = useMemo(
    () => ({ ...cats, gastos: [...cats.gastos, ...cats.inversiones] }),
    [cats]
  );

  const statCell = (label, value, pct, inverse, first) => (
    <div style={{
      flex: 1, minWidth: 0,
      padding: mobile ? '12px 12px' : '16px 20px',
      borderLeft: first ? 'none' : `1px solid ${C.border}`,
    }}>
      <div style={{ fontSize: mobile ? 11.5 : 12.5, fontWeight: 500, color: C.text3, marginBottom: mobile ? 4 : 6 }}>{label}</div>
      <div style={{
        fontSize: mobile ? 15 : 22, fontWeight: 650, color: C.text, marginBottom: mobile ? 6 : 8,
        letterSpacing: '-0.02em',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {hidden ? '••••' : (mobile ? fmtARSInt(value) : fmtARS(value))}
      </div>
      <PctBadge pct={pct} inverse={inverse} compact={mobile} />
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: mobile ? '16px 16px 0' : '28px 32px 0', flexShrink: 0, maxWidth: 1080, width: '100%', margin: '0 auto' }}>
        <MonthNav monthId={monthId} sorted={sorted} setMonthId={setMonthId} style={{ marginBottom: mobile ? 14 : 20 }} />

        {/* Resumen del mes */}
        <div style={{
          display: 'flex', marginBottom: mobile ? 16 : 22,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
          border: `1px solid ${C.border}`, boxShadow: C.elevHi, borderRadius: 16,
        }}>
          {statCell('Ingresos', curIng, pctIng, false, true)}
          {statCell('Gastos', curGas, pctGas, true)}
          {statCell('Neto', curNet, pctNet, false)}
        </div>

        <div style={{ marginBottom: 6 }}>
          <Segmented
            size="sm" value={filter} onChange={setFilter}
            options={[['all', 'Todos'], ['g', 'Gastos'], ['i', 'Ingresos']]}
          />
        </div>
      </div>

      {/* Transaction list */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: mobile ? '0 16px' : '0 32px',
        // Los movimientos se desvanecen al subir por debajo del resumen.
        maskImage: 'linear-gradient(to bottom, transparent 0, #000 14px)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, #000 14px)',
      }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          {grouped.length === 0 && (
            <div style={{ padding: '56px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: C.text2, marginBottom: 4 }}>Sin movimientos</div>
              <div style={{ fontSize: 13, color: C.text3 }}>Tocá + para cargar el primero del mes.</div>
            </div>
          )}
          {grouped.map(([date, dayTxs]) => {
            const dayNet = dayTxs.filter(t => t.currency !== 'USD').reduce((s, t) => s + (t.type === 'i' ? t.amount : -t.amount), 0);
            return (
              <div key={date} style={{ marginTop: 10 }}>
                {/* Encabezado del día: queda pegado arriba y la lista pasa por debajo */}
                <div style={{
                  position: 'sticky', top: 0, zIndex: 2,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  fontSize: 12.5, fontWeight: 500, color: C.text2,
                  padding: '10px 12px', margin: '0 -12px 2px', borderRadius: 10,
                  background: 'rgba(36,36,46,0.5)', ...blur(18),
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.05)',
                }}>
                  <span>{dayLabel(date)}</span>
                  {!hidden && <span>{dayNet >= 0 ? '+' : '−'}{fmtARSInt(dayNet)}</span>}
                </div>
                {dayTxs.map(tx => (
                  <TxRow key={tx.id} tx={tx} cats={cats} onClick={handleRowClick} showDate={false} />
                ))}
              </div>
            );
          })}
          <div style={{ height: 96 }} />
        </div>
      </div>

      <FAB onClick={() => { setEditTx(null); setModalOpen(true); }} />
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTx(null); setEditAllCuotas(null); }}
        title={editTx ? (editAllCuotas ? 'Editar todas las cuotas' : 'Editar movimiento') : 'Nuevo movimiento'}
      >
        <TxForm
          cats={catsForForm} mediums={mediums}
          initial={editTx}
          onSave={handleSave}
          onCancel={() => { setModalOpen(false); setEditTx(null); setEditAllCuotas(null); }}
          onDelete={handleDelete}
        />
      </Modal>
      <CuotaDetailModal
        open={!!cuotaTx} tx={cuotaTx} allTxs={txs}
        onClose={() => setCuotaTx(null)}
        onEditSingle={handleCuotaEditSingle}
        onEditAll={handleCuotaEditAll}
        onDeleteSingle={handleCuotaDeleteSingle}
        onDeleteAll={handleCuotaDeleteAll}
      />
    </div>
  );
}
