import { useEffect, useRef, useState } from 'react';

const THRESHOLD = 65;
const MAX_PULL = 90;

function getScrollParent(el) {
  while (el && el !== document.body) {
    const { overflow, overflowY } = getComputedStyle(el);
    if (/auto|scroll/.test(overflow + overflowY)) return el;
    el = el.parentElement;
  }
  return null;
}

export function usePullToRefresh(onRefresh) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef(0);
  const activeRef = useRef(false);
  const refreshingRef = useRef(false);

  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    const onTouchStart = (e) => {
      if (refreshingRef.current) return;
      const scrollEl = getScrollParent(e.target);
      const atTop = !scrollEl || scrollEl.scrollTop === 0;
      if (atTop) {
        startYRef.current = e.touches[0].clientY;
        activeRef.current = true;
      } else {
        activeRef.current = false;
      }
    };

    const onTouchMove = (e) => {
      if (!activeRef.current || refreshingRef.current) return;
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta > 5) {
        e.preventDefault();
        setPullY(Math.min(delta * 0.5, MAX_PULL));
      } else if (delta < 0) {
        activeRef.current = false;
        setPullY(0);
      }
    };

    const onTouchEnd = async () => {
      if (!activeRef.current) return;
      activeRef.current = false;
      const current = pullY;
      setPullY(0);
      if (current >= THRESHOLD) {
        setRefreshing(true);
        try { await onRefresh(); } finally { setRefreshing(false); }
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [onRefresh, pullY]);

  return { pullY, refreshing, threshold: THRESHOLD };
}
