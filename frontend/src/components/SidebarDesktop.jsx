import React from 'react';
import { C } from '../theme.js';
import NavList from './NavList.jsx';

export default function SidebarDesktop({ screen, onNav }) {
  return (
    <div style={{
      width: 232, flexShrink: 0,
      background: C.bg, borderRight: `1px solid ${C.border}`,
      height: '100%', display: 'flex', flexDirection: 'column',
      padding: '18px 12px 14px',
    }}>
      <NavList screen={screen} onNav={onNav} />
    </div>
  );
}
