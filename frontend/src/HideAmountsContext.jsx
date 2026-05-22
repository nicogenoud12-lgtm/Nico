import React, { createContext, useContext, useState } from 'react';

const Ctx = createContext({ hidden: false, toggle: () => {} });

export function HideAmountsProvider({ children }) {
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem('hide_amounts') === 'true'; } catch { return false; }
  });

  const toggle = () => setHidden(h => {
    const next = !h;
    try { localStorage.setItem('hide_amounts', String(next)); } catch {}
    return next;
  });

  return <Ctx.Provider value={{ hidden, toggle }}>{children}</Ctx.Provider>;
}

export const useHideAmounts = () => useContext(Ctx);
