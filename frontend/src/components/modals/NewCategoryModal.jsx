import { useState } from 'react';

const SWATCHES = ['#e8b86d','#7eb8d4','#d4876b','#a78bda','#6bbf8e','#e88ba0','#f0c060','#60b4b4','#88c070','#d490c0'];

export default function NewCategoryModal({ onClose, onSave, initialValues }) {
  const isEdit = !!initialValues;
  const [name, setName] = useState(initialValues?.name || '');
  const [color, setColor] = useState(initialValues?.color || '#88c070');

  const inp = { width: '100%', padding: '8px 10px', border: '1px solid #e8e4de', borderRadius: 8, fontFamily: 'inherit', fontSize: 14, marginTop: 4, outline: 'none' };

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div style={{ width: '100%', background: '#fafaf8', borderRadius: '24px 24px 0 0', padding: '20px 20px 32px' }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 40, height: 4, background: '#e0ddd8', borderRadius: 2, margin: '0 auto 20px' }} />
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>{isEdit ? 'Editar categoría' : 'Nueva categoría'}</div>
        <label style={{ fontSize: 12, color: '#888' }}>Nombre
          <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="ej. Mascota" />
        </label>
        <label style={{ fontSize: 12, color: '#888', display: 'block', marginTop: 12 }}>Color
          <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            {SWATCHES.map(c => (
              <div key={c} onClick={() => setColor(c)} style={{ width: 28, height: 28, borderRadius: 14, background: c, cursor: 'pointer', boxShadow: color === c ? '0 0 0 3px #1a1a1a' : '' }} />
            ))}
          </div>
        </label>
        <button
          onClick={() => { if (name.trim()) { onSave && onSave({ id: initialValues?.id, oldName: initialValues?.name, name: name.trim(), color }); } onClose(); }}
          style={{ width: '100%', marginTop: 20, padding: '12px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 12, fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
        >
          {isEdit ? 'Actualizar' : 'Crear categoría'}
        </button>
      </div>
    </div>
  );
}
