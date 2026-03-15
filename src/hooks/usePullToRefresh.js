import { useRef, useEffect, useCallback } from 'react';

export default function usePullToRefresh(onRefresh, { threshold = 80, enabled = true } = {}) {
  const startY = useRef(0);
  const pulling = useRef(false);
  const indicatorRef = useRef(null);

  const handleRefresh = useCallback(async () => {
    if (onRefresh) await onRefresh();
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled) return;

    // Create pull indicator element
    const indicator = document.createElement('div');
    indicator.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      display: flex; justify-content: center; align-items: center;
      height: 0; overflow: hidden; transition: height 0.2s;
      background: linear-gradient(to bottom, rgba(241,245,249,0.95), rgba(241,245,249,0));
      pointer-events: none;
    `;
    indicator.innerHTML = `
      <div style="width:24px;height:24px;border:3px solid #cbd5e1;border-top-color:#334155;border-radius:50%;opacity:0;" class="ptr-spinner"></div>
    `;
    document.body.appendChild(indicator);
    indicatorRef.current = indicator;

    const spinner = indicator.querySelector('.ptr-spinner');

    const onTouchStart = (e) => {
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    };

    const onTouchMove = (e) => {
      if (!pulling.current) return;
      const diff = e.touches[0].clientY - startY.current;
      if (diff > 0 && window.scrollY === 0) {
        const progress = Math.min(diff / threshold, 1);
        indicator.style.height = `${Math.min(diff * 0.5, 60)}px`;
        spinner.style.opacity = progress;
        spinner.style.transform = `rotate(${progress * 360}deg)`;
        if (diff > threshold) {
          spinner.style.borderTopColor = '#059669';
        } else {
          spinner.style.borderTopColor = '#334155';
        }
      }
    };

    const onTouchEnd = async (e) => {
      if (!pulling.current) return;
      pulling.current = false;
      const diff = e.changedTouches[0].clientY - startY.current;

      if (diff > threshold && window.scrollY === 0) {
        // Trigger refresh
        spinner.style.animation = 'spin 0.6s linear infinite';
        indicator.style.height = '48px';
        await handleRefresh();
      }

      // Reset
      indicator.style.height = '0';
      spinner.style.opacity = '0';
      spinner.style.animation = '';
    };

    // Add spin keyframe if not exists
    if (!document.getElementById('ptr-keyframe')) {
      const style = document.createElement('style');
      style.id = 'ptr-keyframe';
      style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(style);
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      indicator.remove();
    };
  }, [enabled, threshold, handleRefresh]);
}
