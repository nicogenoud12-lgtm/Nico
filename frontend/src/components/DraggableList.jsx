import { useState } from 'react';
import { COLOR_PALETTE } from '../constants/data.js';

export default function DraggableList({ items, onReorder, onEdit, onDelete, hasColor, addLabel, onAdd }) {
  const [editingIdx, setEditingIdx] = useState(null);
  const [editVal, setEditVal] = useState({});
  const [showColorIdx, setShowColorIdx] = useState(null);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const startEdit = i => {
    setEditingIdx(i);
    setEditVal({ name: items[i].name, color: items[i].color || '' });
    setShowColorIdx(null);
  };
  const saveEdit = i => {
    if (editVal.name?.trim()) onEdit(i, editVal);
    setEditingIdx(null);
    setShowColorIdx(null);
  };

  const handleDragStart = (e, i) => {
    setDragIdx(i);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', i);
  };
  const handleDragOver = (e, i) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIdx(i);
  };
  const handleDrop = (e, i) => {
    e.preventDefault();
    if (dragIdx !== null && dragIdx !== i) {
      const a = [...items];
      const [r] = a.splice(dragIdx, 1);
      a.splice(i, 0, r);
      onReorder(a);
    }
    setDragIdx(null);
    setDragOverIdx(null);
  };
  const handleDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };

  const inp = { flex: 1, padding: '6px 8px', border: '1px solid #e8e4de', borderRadius: 8, fontFamily: 'inherit', fontSize: 14, outline: 'none', background: '#fafaf8' };

  return (
    <div>
      <div className="card" style={{ margin: '0 16px' }}>
        {items.map((item, i) => (
          <div
            key={item.key || item.id || item.name}
            draggable={editingIdx !== i}
            onDragStart={e => handleDragStart(e, i)}
            onDragOver={e => handleDragOver(e, i)}
            onDrop={e => handleDrop(e, i)}
            onDragEnd={handleDragEnd}
            style={{ opacity: dragIdx === i ? 0.4 : 1, background: dragOverIdx === i && dragIdx !== i ? '#e4f2e8' : 'transparent', transition: 'background .1s' }}
          >
            {i > 0 && <div style={{ height: 1, background: '#f0ede8', margin: '0 16px' }} />}
            {editingIdx === i ? (
              <div style={{ padding: '10px 16px', display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}>
                {hasColor && (
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div onClick={() => setShowColorIdx(showColorIdx === i ? null : i)} style={{ width: 28, height: 28, borderRadius: 14, background: editVal.color, border: '2px solid #e8e4de', cursor: 'pointer' }} />
                    {showColorIdx === i && (
                      <div style={{ position: 'absolute', top: 34, left: 0, zIndex: 20, background: '#fff', padding: 8, borderRadius: 10, border: '1px solid #e8e4de', display: 'flex', flexWrap: 'wrap', gap: 5, width: 168, boxShadow: '0 4px 16px rgba(0,0,0,.12)' }}>
                        {COLOR_PALETTE.map(c => (
                          <div
                            key={c}
                            onClick={() => { setEditVal(v => ({ ...v, color: c })); setShowColorIdx(null); }}
                            style={{ width: 24, height: 24, borderRadius: 12, background: c, cursor: 'pointer', boxShadow: editVal.color === c ? '0 0 0 2px #1a1a1a' : '' }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <input style={inp} value={editVal.name} onChange={e => setEditVal(v => ({ ...v, name: e.target.value }))} autoFocus onKeyDown={e => e.key === 'Enter' && saveEdit(i)} />
                <button onClick={() => saveEdit(i)} style={{ padding: '6px 12px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer' }}>OK</button>
                <button onClick={() => setEditingIdx(null)} style={{ padding: '6px 10px', background: '#f0ede8', color: '#555', border: 'none', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer' }}>✕</button>
              </div>
            ) : (
              <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18, color: '#ccc', cursor: 'grab', userSelect: 'none', flexShrink: 0, lineHeight: 1 }}>⠿</span>
                {hasColor && <div style={{ width: 14, height: 14, borderRadius: 7, background: item.color, flexShrink: 0 }} />}
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{item.name}</span>
                <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <button onClick={() => startEdit(i)} style={{ background: 'none', border: 'none', fontSize: 15, cursor: 'pointer', color: '#bbb', padding: '2px 6px' }}>✎</button>
                  <button onClick={() => onDelete(i)} style={{ background: 'none', border: 'none', fontSize: 15, cursor: 'pointer', color: '#e09090', padding: '2px 4px' }}>✕</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <button onClick={onAdd} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 16px 0', padding: '10px 16px', background: '#f5f2ec', border: 'none', borderRadius: 10, fontFamily: 'inherit', fontSize: 14, color: '#555', cursor: 'pointer', width: 'calc(100% - 32px)' }}>
        <span style={{ fontSize: 18, color: '#3a7a50', fontWeight: 700, lineHeight: 1 }}>+</span> {addLabel}
      </button>
    </div>
  );
}
