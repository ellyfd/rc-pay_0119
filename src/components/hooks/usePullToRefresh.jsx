import { useEffect, useRef } from 'react';

export default function usePullToRefresh(onRefresh) {
  const startY = useRef(0);
  const pulling = useRef(false);

  useEffect(() => {
    const handleTouchStart = (e) => {
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    };

    const handleTouchEnd = (e) => {
      if (!pulling.current) return;
      const endY = e.changedTouches[0].clientY;
      const diff = endY - startY.current;
      if (diff > 80) {
        onRefresh();
      }
      pulling.current = false;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onRefresh]);
}