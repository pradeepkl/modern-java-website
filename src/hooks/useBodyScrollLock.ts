import { useEffect } from 'react';

export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    document.body.classList.add('menu-open');
    return () => {
      document.body.classList.remove('menu-open');
    };
  }, [locked]);
}
