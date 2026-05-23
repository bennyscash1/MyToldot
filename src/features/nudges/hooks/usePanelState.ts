'use client';

import { useCallback, useEffect, useState } from 'react';

import { readJSON, writeJSON } from '../lib/storage';

type PanelState = 'open' | 'minimized';

const STORAGE_KEY = 'nudges_panel_state';

/**
 * Persists the open/minimized preference across sessions.
 * First-visit default: 'open' if any nudges exist, else 'minimized'.
 * Subsequent visits: respect the persisted value.
 */
export function usePanelState(initialHasNudges: boolean) {
  const [state, setState] = useState<PanelState>('minimized');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readJSON<PanelState | null>(STORAGE_KEY, null);
    if (stored === 'open' || stored === 'minimized') {
      setState(stored);
    } else {
      setState(initialHasNudges ? 'open' : 'minimized');
    }
    setHydrated(true);
    // intentionally only on mount: initial default depends on first nudges count
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setAndPersist = useCallback((next: PanelState) => {
    setState(next);
    writeJSON(STORAGE_KEY, next);
  }, []);

  return {
    state,
    hydrated,
    open: () => setAndPersist('open'),
    minimize: () => setAndPersist('minimized'),
  };
}
