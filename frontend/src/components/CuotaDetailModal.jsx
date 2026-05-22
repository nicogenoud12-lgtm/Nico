import React, { useMemo } from 'react';
import { C } from '../theme.js';
import Modal from './Modal.jsx';
import { fmtMoney, fmtDate, todayStr } from '../utils/format.js';
import { useHideAmounts } from '../HideAmountsContext.jsx';

export default function CuotaDetailModal({ open, tx, allTxs, onClose }) {
  const cuotas = useMemo(() => {
    if (!tx || !tx.cuota_total) return [];
    const key = (t) => `${t.desc}|${t.tarjeta_id ?? t.medio}|${t.cuota_total}`;
    const k = key(tx);
    return allTxs
      .filter(t => t.cuota_total > 1 && key(t) === k)
      .sort((a, b) => a.cuota_num - b.cuota_num);
  }, [tx, allTxs]);

  const { hidden } = useHideAmounts();

  if (!tx) return null;

  const today = todayStr();
  const total = cuotas.reduce((s, t) => s + Math.abs(t.amount), 0);
  const last = cuotas[cuotas.length - 1];
  const paid = cuotas.filter(t => t.date < today).length;
  const pending = cuotas.filter(t => t.date >= today).length;

  return (
    <Modal open={open} onClose={onClose} title={tx.desc || tx.cat}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Resumen */}
        <div style={{
          display: 'flex', gap: 10,
          padding: '12px 14px', borderRadius: 10,
          background: C.surface2, border: `1px solid ${C.border}`,
        }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Total</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{hidden ? '••••' : fmtMoney(total)}</div>
          </div>
          <div style={{ width: 1, background: C.border }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Pagadas</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.green }}>{paid}</div>
          </div>
          <div style={{ width: 1, background: C.border }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Pendientes</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{pending}</div>
          </div>
        </div>

        {/* Lista de cuotas */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
          {cuotas.map((c, i) => {
            const isPast = c.date < today;
            const isCurrent = c.date === tx.date;
            return (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px',
                borderBottom: i < cuotas.length - 1 ? `1px solid ${C.border}` : 'none',
                background: isCurrent ? C.accentBg : 'transparent',
                opacity: isPast && !isCurrent ? 0.5 : 1,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: isCurrent ? C.accent : isPast ? C.surface2 : C.surface2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  color: isCurrent ? '#fff' : C.text2,
                }}>
                  {c.cuota_num}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: isCurrent ? 600 : 400, color: C.text }}>
                    Cuota {c.cuota_num}/{c.cuota_total}
                  </div>
                  <div style={{ fontSize: 11, color: C.text3 }}>{fmtDate(c.date)}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: isCurrent ? C.accent : C.text }}>
                  {hidden ? '••••' : fmtMoney(c.amount, c.currency || 'ARS')}
                </div>
                {isPast && (
                  <div style={{ fontSize: 11, color: C.green }}>✓</div>
                )}
              </div>
            );
          })}
        </div>

        {last && (
          <div style={{ fontSize: 12, color: C.text3, textAlign: 'center' }}>
            Última cuota: {fmtDate(last.date)}
          </div>
        )}

        <button onClick={onClose} style={{
          padding: '10px', background: C.surface2,
          border: `1px solid ${C.border}`, borderRadius: 8,
          color: C.text2, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer',
        }}>
          Cerrar
        </button>
      </div>
    </Modal>
  );
}
