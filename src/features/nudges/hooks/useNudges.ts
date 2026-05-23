'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { apiClient, ServiceError } from '@/services/api.client';
import type { Nudge, NudgesResponse } from '../lib/nudge-types';
import { useDismissedNudges } from './useDismissedNudges';

interface UseNudgesArgs {
  treeId: string;
  /** Bumped by the parent after any successful tree mutation → triggers refetch. */
  refetchSignal: number;
}

const MAX_VISIBLE = 5;

export function useNudges({ treeId, refetchSignal }: UseNudgesArgs) {
  const [allNudges, setAllNudges] = useState<Nudge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { dismissedKeys, dismiss } = useDismissedNudges(treeId);

  // Cards removed optimistically (Save / Skip) before refetch lands.
  const [localRemoved, setLocalRemoved] = useState<Set<string>>(new Set());

  const refetchRef = useRef(0);

  const fetchNudges = useCallback(async () => {
    const myToken = (refetchRef.current += 1);
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<NudgesResponse>(
        `/api/v1/trees/${treeId}/nudges`,
      );
      if (myToken !== refetchRef.current) return;
      setAllNudges(data.nudges);
      setLocalRemoved(new Set());
    } catch (e) {
      if (myToken !== refetchRef.current) return;
      const msg = e instanceof ServiceError ? e.message : 'Failed to load nudges';
      setError(msg);
    } finally {
      if (myToken === refetchRef.current) setIsLoading(false);
    }
  }, [treeId]);

  useEffect(() => {
    void fetchNudges();
  }, [fetchNudges, refetchSignal]);

  const visible = useMemo(() => {
    return allNudges
      .filter((n) => !dismissedKeys.has(n.id))
      .filter((n) => !localRemoved.has(n.id))
      .slice(0, MAX_VISIBLE);
  }, [allNudges, dismissedKeys, localRemoved]);

  // True visible count includes any not yet rendered (cap at 9+ for badge).
  const totalAvailable = useMemo(() => {
    return allNudges.filter(
      (n) => !dismissedKeys.has(n.id) && !localRemoved.has(n.id),
    ).length;
  }, [allNudges, dismissedKeys, localRemoved]);

  const removeLocally = useCallback((nudgeId: string) => {
    setLocalRemoved((prev) => {
      const next = new Set(prev);
      next.add(nudgeId);
      return next;
    });
  }, []);

  const skipNudge = useCallback(
    (nudgeId: string) => {
      dismiss(nudgeId);
      removeLocally(nudgeId);
    },
    [dismiss, removeLocally],
  );

  return {
    nudges: visible,
    totalAvailable,
    isLoading,
    error,
    refetch: fetchNudges,
    skip: skipNudge,
    removeLocally,
  };
}
