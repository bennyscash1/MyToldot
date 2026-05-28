'use client';

import { useEffect } from 'react';

export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return;
    }

    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', () => {
          if (!cancelled && active) {
            void acquire();
          }
        });
      } catch {
        /* unsupported or denied */
      }
    };

    void acquire();

    return () => {
      cancelled = true;
      void lock?.release();
    };
  }, [active]);
}
