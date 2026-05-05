import React, { useState, useMemo } from 'react';
import { C, s } from '../theme.js';
import { todayStr } from '../utils/format.js';

export default function TxForm({ cats, mediums, onSave, onCancel, initial }) {
  const [type, setType] = useState(initial?.type || 'g');
  const [amount, setAmount] = useState(initial?.amount != null ? String(Math.abs(initial.amount)) : '');
  const [currency, setCurrency] = useState(initial?.currency || 'ARS');
  const [cat, setCat] = useState(initial?.cat || '');
  const [medio, setMedio] = useState(initial?.medio || '');
  const [desc, setDesc] = useState(initial?.desc || '');
  const [date, setDate] = useState(initial?.date || todayStr());
  const [cuotas, setCuotas] = useState(initial?.cuota_total || 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const availCats = useMemo(() => type === 'i' ? cats.ingresos : cats.gastos, [type, cats]);

  const handleTypeChange = (newType) => {
    setType(newType);
    // solo limpiar cat si no existe en la nueva lista
    const newList = newType === 'i' ? cats.ingresos : cats.gastos;
    if (cat && !newList.find(c => c.name === cat)) setCat('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const n = Math.abs(parseFloat(amount));
    if (!n) { setError('El importe debe ser mayor a 0'); return; }
    if (!cat) { setError('Seleccioná una categoría'); return; }
    if (!date) { setError('Seleccioná una fecha'); return; }
    setError('');
    setSaving(true);
    try {
      await onSave({ type, amount: n, currency, cat, medio, desc, date }, cuotas);
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Error al guardar';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
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
            onClick={() => handleTypeChange(v)}
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
            type="number" step="any"
            placeholder="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
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
        <select style={s.select} value={cat} onChange={e => setCat(e.target.value)}>
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
        <input style={s.input} type="date" value={date} onChange={e => setDate(e.target.value)} />
      </div>

      {/* desc */}
      <div style={row}>
        <span style={label}>Descripción (opcional)</span>
        <input style={s.input} type="text" placeholder="Nota" value={desc} onChange={e => setDesc(e.target.value)} />
      </div>

      {/* cuotas (only for gastos, not editing) */}
      {type === 'g' && !initial && (
        <div style={row}>
          <span style={label}>Cuotas</span>
          <select style={s.select} value={cuotas} onChange={e => setCuotas(Number(e.target.value))}>
            {[1,2,3,4,5,6,9,12,18,24].map(n => <option key={n} value={n}>{n === 1 ? 'Sin cuotas' : `${n} cuotas`}</option>)}
          </select>
        </div>
      )}

      {error && (
        <div style={{ fontSize: 12, color: C.red, background: C.red + '18', borderRadius: 8, padding: '8px 12px' }}>
          {error}
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
