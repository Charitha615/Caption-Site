import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

export interface VirtualListHandle {
  /** Scroll so the item is visible; no-op when it already is. */
  ensureVisible: (index: number) => void;
}

/**
 * Minimal fixed-row-height virtual list. Renders only the visible rows plus an
 * overscan, so a 2,000-caption project mounts ~15 rows instead of 2,000.
 */
export const VirtualList = forwardRef<VirtualListHandle, {
  count: number;
  rowHeight: number;
  overscan?: number;
  className?: string;
  renderRow: (index: number) => React.ReactNode;
  getKey: (index: number) => string;
}>(function VirtualList({ count, rowHeight, overscan = 6, className = '', renderRow, getKey }, ref) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({ top: 0, height: 600 });

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setRange((r) => (r.top === el.scrollTop && r.height === el.clientHeight ? r : { top: el.scrollTop, height: el.clientHeight }));
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    };
    measure();
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(onScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [measure]);

  useImperativeHandle(ref, () => ({
    ensureVisible(index) {
      const el = scrollRef.current;
      if (!el || index < 0) return;
      const top = index * rowHeight;
      if (top < el.scrollTop) el.scrollTop = top - 8;
      else if (top + rowHeight > el.scrollTop + el.clientHeight) el.scrollTop = top + rowHeight - el.clientHeight + 8;
    },
  }), [rowHeight]);

  const first = Math.max(0, Math.floor(range.top / rowHeight) - overscan);
  const last = Math.min(count, Math.ceil((range.top + range.height) / rowHeight) + overscan);
  const rows: React.ReactNode[] = [];
  for (let i = first; i < last; i++) {
    rows.push(
      <div key={getKey(i)} className="ed-vrow" style={{ transform: `translateY(${i * rowHeight}px)`, height: rowHeight }}>
        {renderRow(i)}
      </div>
    );
  }

  return (
    <div ref={scrollRef} className={`ed-vlist ${className}`}>
      <div style={{ height: count * rowHeight, position: 'relative' }}>{rows}</div>
    </div>
  );
});
