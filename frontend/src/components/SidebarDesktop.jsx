import React from 'react';
import { C, blur } from '../theme.js';
import NavList from './NavList.jsx';

export default function SidebarDesktop({ screen, onNav }) {
  return (
    <div style={{
      width: 232, flexShrink: 0,
      background: 'rgba(9,9,11,0.45)', ...blur(24), borderRight: `1px solid ${C.border}`,
      height: '100%', display: 'flex', flexDirection: 'column',
      padding: '18px 12px 14px',
    }}>
      <NavList screen={screen} onNav={onNav} />
    </div>
  );
}
