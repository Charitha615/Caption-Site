import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';

export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

const query = (q: string) => (typeof window !== 'undefined' ? window.matchMedia(q) : null);

function readBreakpoint(): Breakpoint {
  if (query('(max-width: 767px)')?.matches) return 'mobile';
  if (query('(max-width: 1279px)')?.matches) return 'tablet';
  return 'desktop';
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(readBreakpoint);
  useEffect(() => {
    const queries = ['(max-width: 767px)', '(max-width: 1279px)'].map((q) => window.matchMedia(q));
    const update = () => setBp(readBreakpoint());
    queries.forEach((q) => q.addEventListener('change', update));
    return () => queries.forEach((q) => q.removeEventListener('change', update));
  }, []);
  return bp;
}

export function useElementSize<T extends HTMLElement>(ref: RefObject<T | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize((prev) => (prev.width === r.width && prev.height === r.height ? prev : { width: r.width, height: r.height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}
