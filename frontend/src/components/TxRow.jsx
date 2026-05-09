import React, { useState } from 'react';
import { C } from '../theme.js';
import { fmtMoney, fmtDate } from '../utils/format.js';

export default function TxRow({ tx, cats, onClick }) {
  const [hovered, setHovered] = useState(false);
  const list = tx.type === 'i' ? cats.ingresos : cats.gastos;
  const cat = list.find(c => c.name === tx.cat);
  const color = cat?.color || (tx.type === 'i' ? C.green : C.red);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick ? () => onClick(tx) : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 8px',
        borderRadius: 8,
        background: hovered && onClick ? C.surface2 : 'transparent',
        transition: 'background .15s',
        margin: '0 -8px',
        cursor: onClick ? 'pointer' : 'default',
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
        <div style={{ fontSize: 12, color: C.text3, marginTop: 1, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <span>{tx.cat}{tx.medio ? ` · ${tx.medio}` : ''}</span>
          {tx.cuota_num && tx.cuota_total && (
            <span style={{
              fontSize: 10, fontWeight: 700, lineHeight: 1,
              color: C.accent, background: C.accentBg,
              padding: '2px 5px', borderRadius: 4,
              letterSpacing: '.02em',
            }}>
              {tx.cuota_num}/{tx.cuota_total}
            </span>
          )}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: tx.type === 'i' ? C.green : C.text }}>
          {tx.type === 'i' ? '+' : ''}{fmtMoney(tx.amount, tx.currency || 'ARS')}
        </div>
        <div style={{ fontSize: 11, color: C.text3, marginTop: 1 }}>{fmtDate(tx.date)}</div>
      </div>
    </div>
  );
}
