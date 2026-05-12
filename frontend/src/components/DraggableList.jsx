import React, { useState } from 'react';
import { C, COLOR_PALETTE } from '../theme.js';

export default function DraggableList({ items, onReorder, onEdit, onDelete, hasColor, addLabel, onAdd }) {
  const [editingIdx, setEditingIdx] = useState(null);
  const [editVal, setEditVal] = useState({});
  const [showColorIdx, setShowColorIdx] = useState(null);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [hoveredIdx, setHoveredIdx] = useState(null);

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

  const handleSortAZ = () => {
    const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    onReorder(sorted);
  };

  const handleDragStart = (e, i) => {
    setDragIdx(i);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e, i) => {
    e.preventDefault();
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
    setDragIdx(null); setDragOverIdx(null);
  };
  const handleDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };

  const inp = {
    flex: 1, padding: '6px 10px',
    background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6,
    color: C.text, fontFamily: 'Inter, sans-serif', fontSize: 14, outline: 'none',
  };

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'visible' }}>
      {items.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 10px', borderBottom: `1px solid ${C.border}` }}>
          <button
            onClick={handleSortAZ}
            title="Ordenar A→Z"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 10px', borderRadius: 6, border: `1px solid ${C.border}`,
              background: 'transparent', color: C.text3,
              fontFamily: 'inherit', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              letterSpacing: '.04em',
            }}
          >
            A→Z
          </button>
        </div>
      )}
      {items.map((item, i) => (
        <div
          key={item.id}
          draggable={editingIdx !== i}
          onDragStart={e => handleDragStart(e, i)}
          onDragOver={e => handleDragOver(e, i)}
          onDrop={e => handleDrop(e, i)}
          onDragEnd={handleDragEnd}
          onMouseEnter={() => setHoveredIdx(i)}
          onMouseLeave={() => setHoveredIdx(null)}
          style={{
            opacity: dragIdx === i ? 0.4 : 1,
            background: (dragOverIdx === i && dragIdx !== i) || (hoveredIdx === i && editingIdx !== i) ? C.surface2 : 'transparent',
            borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none',
            transition: 'background .15s',
          }}
        >
          {editingIdx === i ? (
            <div style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}>
              {hasColor && (
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div
                    onClick={() => setShowColorIdx(showColorIdx === i ? null : i)}
                    style={{ width: 26, height: 26, borderRadius: 13, background: editVal.color, border: `2px solid ${C.border2}`, cursor: 'pointer' }}
                  />
                  {showColorIdx === i && (
                    <div style={{
                      position: 'absolute',
                      ...(i >= items.length - 2 && items.length > 2
                        ? { bottom: 32, left: 0 }
                        : { top: 32, left: 0 }),
                      zIndex: 20,
                      background: C.surface2, padding: 8, borderRadius: 10,
                      border: `1px solid ${C.border}`, display: 'flex', flexWrap: 'wrap', gap: 6,
                      width: 172, boxShadow: '0 8px 24px rgba(0,0,0,.5)',
                    }}>
                      {COLOR_PALETTE.map(c => (
                        <div
                          key={c}
                          onClick={() => { setEditVal(v => ({ ...v, color: c })); setShowColorIdx(null); }}
                          style={{
                            width: 24, height: 24, borderRadius: 12, background: c, cursor: 'pointer',
                            outline: editVal.color === c ? `2px solid ${C.text}` : 'none',
                            outlineOffset: 2,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
              <input
                style={inp} value={editVal.name}
                onChange={e => setEditVal(v => ({ ...v, name: e.target.value }))}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && saveEdit(i)}
              />
              <button
                onClick={() => saveEdit(i)}
                style={{ padding: '6px 12px', background: C.accent, color: '#fff', border: 'none', borderRadius: 6, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer' }}
              >
                OK
              </button>
              <button
                onClick={() => setEditingIdx(null)}
                style={{ padding: '6px 10px', background: C.surface2, color: C.text2, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
          ) : (
            <div
              onClick={() => startEdit(i)}
              style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
            >
              <span style={{ fontSize: 16, color: C.text3, cursor: 'grab', userSelect: 'none', flexShrink: 0 }}>⠿</span>
              {hasColor && <div style={{ width: 12, height: 12, borderRadius: 6, background: item.color, flexShrink: 0 }} />}
              <span style={{ flex: 1, fontSize: 14, color: C.text }}>{item.name}</span>
              <button
                onClick={e => { e.stopPropagation(); onDelete(i); }}
                style={{ background: 'none', border: 'none', fontSize: 14, cursor: 'pointer', color: C.red, padding: '2px 6px' }}
              >✕</button>
            </div>
          )}
        </div>
      ))}
      {onAdd && (
        <button
          onClick={onAdd}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            width: '100%', padding: '12px 14px',
            background: 'transparent', border: 'none', borderTop: items.length > 0 ? `1px solid ${C.border}` : 'none',
            color: C.text2, fontFamily: 'inherit', fontSize: 14, cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 18, color: C.accent, lineHeight: 1 }}>+</span> {addLabel}
        </button>
      )}
    </div>
  );
}
