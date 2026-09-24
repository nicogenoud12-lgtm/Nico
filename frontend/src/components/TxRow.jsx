import React, { useState } from 'react';
import { C } from '../theme.js';
import { fmtMoney, fmtDate } from '../utils/format.js';
import CatIconBadge from './CatIconBadge.jsx';
import { useHideAmounts } from '../HideAmountsContext.jsx';

// showDate: en las listas agrupadas por día la fecha ya está en el encabezado.
export default function TxRow({ tx, cats, onClick, showDate = true }) {
  const [hovered, setHovered] = useState(false);
  const { hidden } = useHideAmounts();
  const list = tx.type === 'i' ? cats.ingresos : cats.gastos;
  const cat = list.find(c => c.name === tx.cat);
  const color = cat?.color || (tx.type === 'i' ? C.green : C.red);
  const isIncome = tx.type === 'i';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick ? () => onClick(tx) : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 10px',
        borderRadius: 12,
        background: hovered && onClick ? 'rgba(255,255,255,.035)' : 'transparent',
        transition: 'background .15s',
        margin: '0 -10px',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <CatIconBadge cat={tx.cat} color={color} size={38} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {tx.desc || tx.cat}
        </div>
        <div style={{ fontSize: 12.5, color: C.text3, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {tx.cat}{tx.medio ? ` · ${tx.medio}` : ''}
          </span>
          {tx.cuota_num && tx.cuota_total && (
            <span style={{
              fontSize: 10.5, fontWeight: 600, lineHeight: 1, flexShrink: 0,
              color: '#a5a4ff', border: `1px solid ${C.accent}55`,
              padding: '2px 5px', borderRadius: 5,
            }}>
              {tx.cuota_num}/{tx.cuota_total}
            </span>
          )}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: isIncome ? C.green : C.text, letterSpacing: '-0.01em' }}>
          {hidden ? '••••' : `${isIncome ? '+' : '−'}${fmtMoney(tx.amount, tx.currency || 'ARS')}`}
        </div>
        {showDate && <div style={{ fontSize: 11.5, color: C.text3, marginTop: 2 }}>{fmtDate(tx.date)}</div>}
      </div>
    </div>
  );
}
