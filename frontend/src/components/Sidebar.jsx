import React from 'react';
import { C, blur } from '../theme.js';
import NavList from './NavList.jsx';

export default function Sidebar({ open, onClose, screen, onNav }) {
  if (!open) return null;
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
          animation: 'fade-in .2s ease',
        }}
      />
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 201,
        width: 272, maxWidth: '82vw', background: 'rgba(18,18,22,0.78)', ...blur(28), borderRight: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column',
        padding: 'calc(18px + env(safe-area-inset-top)) 12px calc(14px + env(safe-area-inset-bottom))',
        animation: 'drawer-in .25s cubic-bezier(.2,.8,.2,1)',
        boxShadow: '24px 0 60px -10px rgba(0,0,0,.6), inset -1px 0 0 rgba(255,255,255,.04)',
      }}>
        <NavList screen={screen} onNav={(id) => { onNav(id); onClose(); }} />
      </div>
    </>
  );
}
