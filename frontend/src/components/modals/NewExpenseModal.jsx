import { useState } from 'react';
import { CATS_GASTO, MEDIOS } from '../../constants/data.js';
import { todayStr, dateToMonthId } from '../../utils/format.js';

export default function NewExpenseModal({ onClose, onSave, onDelete, initialValues, catList, medioList }) {
  const isEdit = !!initialValues;
  const gastoCats = catList ? catList.filter(c => c.kind !== 'ingreso').map(c => c.name) : CATS_GASTO;
  const availableMedios = medioList ? medioList.map(m => m.name) : MEDIOS;

  const [desc, setDesc] = useState(initialValues?.desc || '');
  const [amt, setAmt] = useState(initialValues ? Math.abs(initialValues.amt).toString() : '');
  const [cat, setCat] = useState(initialValues?.cat || gastoCats[0] || '');
  const [medio, setMedio] = useState(initialValues?.medio || availableMedios[0] || '');
  const [type, setType] = useState(initialValues?.type || 'g');
  const [date, setDate] = useState(initialValues?.date || todayStr());

  const inp = { width: '100%', padding: '8px 10px', border: '1px solid #e8e4de', borderRadius: 8, fontFamily: 'inherit', fontSize: 14, marginTop: 4, outline: 'none', background: '#fff' };

  const handleSave = () => {
    if (!desc.trim() || !amt || isNaN(Number(amt))) return;
    onSave({
      month: dateToMonthId(date),
      date,
      desc: desc.trim(),
      cat: type === 'i' ? 'Ingresos' : cat,
      medio,
      amt: type === 'i' ? Math.abs(Number(amt)) : -Math.abs(Number(amt)),
      type
    });
    onClose();
  };

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div style={{ width: '100%', background: '#fafaf8', borderRadius: '24px 24px 0 0', padding: '20px 20px 32px' }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 40, height: 4, background: '#e0ddd8', borderRadius: 2, margin: '0 auto 20px' }} />
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>{isEdit ? 'Editar movimiento' : 'Nuevo movimiento'}</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {[['g', 'Gasto'], ['i', 'Ingreso']].map(([v, l]) => (
            <button key={v} onClick={() => setType(v)} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: 8, background: type === v ? '#1a1a1a' : '#f0ede8', color: type === v ? '#fff' : '#555', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        <label style={{ fontSize: 12, color: '#888', display: 'block' }}>Descripción
          <input style={inp} value={desc} onChange={e => setDesc(e.target.value)} placeholder="ej. Asado" />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
          <label style={{ fontSize: 12, color: '#888', display: 'block' }}>Importe
            <input style={inp} value={amt} onChange={e => setAmt(e.target.value)} placeholder="0" type="number" />
          </label>
          <label style={{ fontSize: 12, color: '#888', display: 'block' }}>Fecha
            <input style={inp} value={date} onChange={e => setDate(e.target.value)} type="date" />
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
          {type === 'g' && (
            <label style={{ fontSize: 12, color: '#888', display: 'block' }}>Categoría
              <select style={inp} value={cat} onChange={e => setCat(e.target.value)}>
                {gastoCats.map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
          )}
          <label style={{ fontSize: 12, color: '#888', display: 'block', gridColumn: type === 'i' ? '1 / -1' : 'auto' }}>Medio
            <select style={inp} value={medio} onChange={e => setMedio(e.target.value)}>
              {availableMedios.map(m => <option key={m}>{m}</option>)}
            </select>
          </label>
        </div>
        <button onClick={handleSave} style={{ width: '100%', marginTop: 16, padding: '12px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 12, fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>{isEdit ? 'Actualizar' : 'Guardar'}</button>
        {isEdit && onDelete && (
          <button onClick={() => { onDelete(initialValues.id); onClose(); }} style={{ width: '100%', marginTop: 8, padding: '10px', background: 'transparent', color: '#c04030', border: '1px solid #f0d8d4', borderRadius: 12, fontFamily: 'inherit', fontSize: 14, cursor: 'pointer' }}>Eliminar</button>
        )}
      </div>
    </div>
  );
}
