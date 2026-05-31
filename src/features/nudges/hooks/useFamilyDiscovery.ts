'use client';

import { useCallback, useMemo, useState } from 'react';

import { discoverFamilyMembersAction } from '@/server/actions/family-discovery.actions';

import type { FamilyMemberProposalDto } from '../lib/family-discovery-types';

export type FamilyDiscoveryStatus = 'idle' | 'loading' | 'error';

interface UseFamilyDiscoveryArgs {
  treeId: string;
  /** Hebrew full names already in the tree (for client-side dedupe on re-runs). */
  existingPersonNamesHe: string[];
}

function normalizeHebrewName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function useFamilyDiscovery({ treeId, existingPersonNamesHe }: UseFamilyDiscoveryArgs) {
  const [proposals, setProposals] = useState<FamilyMemberProposalDto[]>([]);
  const [status, setStatus] = useState<FamilyDiscoveryStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const existingNamesSet = useMemo(
    () => new Set(existingPersonNamesHe.map((n) => normalizeHebrewName(n))),
    [existingPersonNamesHe],
  );

  const discover = useCallback(async () => {
    setStatus('loading');
    setError(null);

    const result = await discoverFamilyMembersAction(treeId);
    if (!result.ok) {
      setStatus('error');
      setError(result.error.message);
      return;
    }

    setProposals((prev) => {
      const visibleKeys = new Set(prev.map((p) => p.dedupeKey));
      const incoming = result.data.proposals.filter((p) => {
        if (visibleKeys.has(p.dedupeKey)) return false;
        const nameKey = normalizeHebrewName(`${p.firstNameHe} ${p.lastNameHe}`);
        if (existingNamesSet.has(nameKey)) return false;
        return true;
      });
      return [...prev, ...incoming];
    });
    setStatus('idle');
  }, [treeId, existingNamesSet]);

  const dismissProposal = useCallback((dedupeKey: string) => {
    setProposals((prev) => prev.filter((p) => p.dedupeKey !== dedupeKey));
  }, []);

  const removeProposal = useCallback((dedupeKey: string) => {
    setProposals((prev) => prev.filter((p) => p.dedupeKey !== dedupeKey));
  }, []);

  const removeProposals = useCallback((dedupeKeys: string[]) => {
    const keys = new Set(dedupeKeys);
    setProposals((prev) => prev.filter((p) => !keys.has(p.dedupeKey)));
  }, []);

  const resetError = useCallback(() => {
    setError(null);
    setStatus('idle');
  }, []);

  return {
    proposals,
    status,
    error,
    discover,
    dismissProposal,
    removeProposal,
    removeProposals,
    resetError,
  };
}
