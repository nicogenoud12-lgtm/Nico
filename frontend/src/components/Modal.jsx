import React, { useEffect } from 'react';
import { C } from '../theme.js';

export default function Modal({ open, onClose, title, children, maxWidth = 480 }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth,
          background: C.surface, borderRadius: '16px 16px 0 0',
          border: `1px solid ${C.border}`, borderBottom: 'none',
          padding: '20px 20px 32px',
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        {title && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{title}</span>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: C.text2, fontSize: 20, cursor: 'pointer', padding: '0 4px' }}
            >
              ×
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
