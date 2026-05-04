import React, { useState, useEffect } from 'react';
import { C, s } from '../theme.js';
import { todayStr } from '../utils/format.js';

export default function TxForm({ cats, mediums, onSave, onCancel, initial }) {
  const [type, setType] = useState(initial?.type || 'g');
  const [amount, setAmount] = useState(initial?.amount ? String(initial.amount) : '');
  const [currency, setCurrency] = useState(initial?.currency || 'ARS');
  const [cat, setCat] = useState(initial?.cat || '');
  const [medio, setMedio] = useState(initial?.medio || '');
  const [desc, setDesc] = useState(initial?.desc || '');
  const [date, setDate] = useState(initial?.date || todayStr());
  const [cuotas, setCuotas] = useState(1);
  const [saving, setSaving] = useState(false);

  const availCats = type === 'i' ? cats.ingresos : cats.gastos;

  useEffect(() => {
    if (cat && !availCats.find(c => c.name === cat)) setCat('');
  }, [type]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const n = parseFloat(amount);
    if (!n || !cat || !date) return;
    setSaving(true);
    try {
      await onSave({ type, amount: n, currency, cat, medio, desc, date }, cuotas);
    } finally {
      setSaving(false);
    }
  };

  const row = { display: 'flex', flexDirection: 'column', gap: 6 };
  const label = { fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em' };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* type toggle */}
      <div style={{ display: 'flex', background: C.surface2, borderRadius: 8, padding: 3, gap: 3 }}>
        {[['g', 'Gasto'], ['i', 'Ingreso']].map(([v, l]) => (
          <button
            key={v} type="button"
            onClick={() => setType(v)}
            style={{
              flex: 1, padding: '7px 0', borderRadius: 6, border: 'none',
              background: type === v ? (v === 'g' ? C.red : C.green) : 'transparent',
              color: type === v ? '#fff' : C.text2,
              fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              transition: 'background .15s',
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {/* amount + currency */}
      <div style={row}>
        <span style={label}>Importe</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={{ ...s.input, flex: 1 }}
            type="number" step="any" min="0"
            placeholder="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            required
            autoFocus
          />
          <select
            style={{ ...s.select, width: 80 }}
            value={currency}
            onChange={e => setCurrency(e.target.value)}
          >
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      {/* category */}
      <div style={row}>
        <span style={label}>Categoría</span>
        <select style={s.select} value={cat} onChange={e => setCat(e.target.value)} required>
          <option value="">Seleccionar…</option>
          {availCats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </div>

      {/* medium */}
      <div style={row}>
        <span style={label}>Medio</span>
        <select style={s.select} value={medio} onChange={e => setMedio(e.target.value)}>
          <option value="">Sin medio</option>
          {mediums.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
        </select>
      </div>

      {/* date */}
      <div style={row}>
        <span style={label}>Fecha</span>
        <input style={s.input} type="date" value={date} onChange={e => setDate(e.target.value)} required />
      </div>

      {/* desc */}
      <div style={row}>
        <span style={label}>Descripción (opcional)</span>
        <input style={s.input} type="text" placeholder="Nota" value={desc} onChange={e => setDesc(e.target.value)} />
      </div>

      {/* cuotas (only for gastos, not ingreso) */}
      {type === 'g' && (
        <div style={row}>
          <span style={label}>Cuotas</span>
          <select style={s.select} value={cuotas} onChange={e => setCuotas(Number(e.target.value))}>
            {[1,2,3,4,5,6,9,12,18,24].map(n => <option key={n} value={n}>{n === 1 ? 'Sin cuotas' : `${n} cuotas`}</option>)}
          </select>
        </div>
      )}

      {/* actions */}
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button type="button" onClick={onCancel} style={{ ...s.btnGhost, flex: 1 }}>Cancelar</button>
        <button type="submit" disabled={saving} style={{ ...s.btnPrimary, flex: 1, opacity: saving ? 0.7 : 1 }}>
          {saving ? '…' : (initial ? 'Guardar' : 'Agregar')}
        </button>
      </div>
    </form>
  );
}
