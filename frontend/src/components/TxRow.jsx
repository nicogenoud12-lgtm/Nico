import React, { useState } from 'react';
import { C } from '../theme.js';
import { fmtMoney, fmtDate } from '../utils/format.js';

export default function TxRow({ tx, cats, onEdit, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const list = tx.type === 'i' ? cats.ingresos : cats.gastos;
  const cat = list.find(c => c.name === tx.cat);
  const color = cat?.color || (tx.type === 'i' ? C.green : C.red);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 8px',
        borderRadius: 8,
        background: hovered ? C.surface2 : 'transparent',
        transition: 'background .15s',
        margin: '0 -8px',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: color + '22',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background .15s',
      }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {tx.desc || tx.cat}
        </div>
        <div style={{ fontSize: 12, color: C.text3, marginTop: 1 }}>
          {tx.cat}
          {tx.medio ? ` · ${tx.medio}` : ''}
          {tx.cuota_num && tx.cuota_total ? ` · cuota ${tx.cuota_num}/${tx.cuota_total}` : ''}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: tx.type === 'i' ? C.green : C.text }}>
          {tx.type === 'i' ? '+' : ''}{fmtMoney(tx.amount, tx.currency || 'ARS')}
        </div>
        <div style={{ fontSize: 11, color: C.text3, marginTop: 1 }}>{fmtDate(tx.date)}</div>
      </div>
      {(onEdit || onDelete) && (
        <div style={{
          display: 'flex', gap: 4, flexShrink: 0,
          opacity: hovered ? 1 : 0,
          transition: 'opacity .15s',
        }}>
          {onEdit && (
            <button
              onClick={() => onEdit(tx)}
              style={{ background: 'none', border: 'none', color: C.text3, fontSize: 14, cursor: 'pointer', padding: '2px 4px' }}
            >✎</button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(tx)}
              style={{ background: 'none', border: 'none', color: C.red, fontSize: 14, cursor: 'pointer', padding: '2px 4px' }}
            >✕</button>
          )}
        </div>
      )}
    </div>
  );
}
