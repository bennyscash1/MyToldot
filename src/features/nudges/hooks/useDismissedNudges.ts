'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { readJSON, writeJSON } from '../lib/storage';

const TTL_MS = 14 * 24 * 60 * 60 * 1000;

type DismissedMap = Record<string, number>;

function pruneExpired(map: DismissedMap, now: number): DismissedMap {
  const out: DismissedMap = {};
  for (const [k, ts] of Object.entries(map)) {
    if (now - ts < TTL_MS) out[k] = ts;
  }
  return out;
}

export function useDismissedNudges(treeId: string) {
  const storageKey = useMemo(() => `dismissed_nudges_${treeId}`, [treeId]);
  const [map, setMap] = useState<DismissedMap>({});

  // Prune-on-mount.
  useEffect(() => {
    const raw = readJSON<DismissedMap>(storageKey, {});
    const pruned = pruneExpired(raw, Date.now());
    setMap(pruned);
    if (Object.keys(pruned).length !== Object.keys(raw).length) {
      writeJSON(storageKey, pruned);
    }
  }, [storageKey]);

  const dismiss = useCallback(
    (nudgeId: string) => {
      setMap((prev) => {
        const next = { ...prev, [nudgeId]: Date.now() };
        writeJSON(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const dismissedKeys = useMemo(() => new Set(Object.keys(map)), [map]);

  return { dismissedKeys, dismiss };
}
