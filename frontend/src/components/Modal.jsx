import React, { useEffect, useState } from 'react';
import { C, blur } from '../theme.js';
import { X } from './Icons.jsx';

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return mobile;
}

// Mobile: bottom sheet con "manija". Desktop: diálogo centrado.
export default function Modal({ open, onClose, title, children, maxWidth = 480 }) {
  const mobile = useIsMobile();

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
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
        display: 'flex', alignItems: mobile ? 'flex-end' : 'center', justifyContent: 'center',
        padding: mobile ? 0 : 24,
        animation: 'fade-in .18s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        role="dialog" aria-modal="true"
        style={{
          width: '100%', maxWidth,
          background: 'rgba(22,22,27,0.8)', ...blur(28),
          borderRadius: mobile ? '20px 20px 0 0' : 18,
          border: `1px solid ${C.border2}`, borderBottom: mobile ? 'none' : `1px solid ${C.border2}`,
          padding: mobile ? '8px 20px calc(24px + env(safe-area-inset-bottom))' : '22px 24px 24px',
          maxHeight: mobile ? '92vh' : '88vh', overflowY: 'auto',
          boxShadow: C.elevHi,
          animation: mobile ? 'sheet-up .28s cubic-bezier(.2,.8,.2,1)' : 'dialog-in .2s ease',
        }}
      >
        {mobile && (
          <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border2, margin: '0 auto 14px' }} />
        )}
        {title && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <span style={{ fontSize: 17, fontWeight: 650, color: C.text, letterSpacing: '-0.01em' }}>{title}</span>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              style={{
                width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: C.surface2, color: C.text2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={15} strokeWidth={2.25} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
