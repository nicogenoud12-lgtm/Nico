import React from 'react';
import { C } from '../theme.js';
import { MONTH_SHORT, dateToMonthId, fmtARS, sortMonthIdsDesc } from '../utils/format.js';
import SparkBar from './SparkBar.jsx';
import TarjetaCard from './TarjetaCard.jsx';

export default function TarjetaDetail({ tarjeta, txs, allMonthIds, onEdit, onDelete, onClose }) {
  const cardTxs = txs.filter(t => t.tarjeta_id === tarjeta.id || t.medio === tarjeta.nombre);

  const last12 = sortMonthIdsDesc(allMonthIds).slice(0, 12).reverse();
  const sparkData = last12.map(id => {
    const val = cardTxs.filter(t => t.type === 'g' && dateToMonthId(t.date) === id)
      .reduce((s, t) => s + t.amount, 0);
    return { value: val, label: MONTH_SHORT[parseInt(id.slice(0, 2), 10) - 1] };
  });

  const total = cardTxs.filter(t => t.type === 'g').reduce((s, t) => s + t.amount, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <TarjetaCard tarjeta={tarjeta} />
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={onEdit}
          style={{
            flex: 1, padding: '9px 0', background: C.surface2,
            border: `1px solid ${C.border}`, borderRadius: 8,
            color: C.text2, fontFamily: 'inherit', fontSize: 14, cursor: 'pointer',
          }}
        >
          Editar
        </button>
        <button
          onClick={() => { if (window.confirm('¿Eliminar tarjeta?')) onDelete(); }}
          style={{
            flex: 1, padding: '9px 0', background: C.redBg,
            border: `1px solid ${C.red}40`, borderRadius: 8,
            color: C.red, fontFamily: 'inherit', fontSize: 14, cursor: 'pointer',
          }}
        >
          Eliminar
        </button>
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
          Total gastado (registrado)
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{fmtARS(total)}</div>
      </div>

      {sparkData.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
            Gastos últimos 12 meses
          </div>
          <SparkBar data={sparkData} />
        </div>
      )}
    </div>
  );
}
