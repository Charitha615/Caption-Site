import { useEffect, useState } from 'react';

/** True while the user asks the OS for less movement. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    const read = () => setReduced(query.matches);
    query.addEventListener('change', read);
    return () => query.removeEventListener('change', read);
  }, []);
  return reduced;
}
