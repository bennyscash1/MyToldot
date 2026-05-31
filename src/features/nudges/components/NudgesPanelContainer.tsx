'use client';

import { useCallback, useMemo, useState } from 'react';

import type { FamilyMemberProposalDto } from '@/features/nudges/lib/family-discovery-types';

import { useFamilyDiscovery } from '../hooks/useFamilyDiscovery';
import { useNudges } from '../hooks/useNudges';
import { usePanelState } from '../hooks/usePanelState';
import { NudgesPanel } from './NudgesPanel';
import { NudgesPanelBubble } from './NudgesPanelBubble';

interface NudgesPanelContainerProps {
  treeId: string;
  /** Bumped by the parent after a successful tree mutation. */
  refetchSignal: number;
  /** Hebrew full names of persons currently in the tree (for dedupe). */
  existingPersonNamesHe: string[];
  onCommitProposal: (proposal: FamilyMemberProposalDto) => Promise<boolean>;
  /** Opens the existing PersonSidePanel focused on the bio textarea. */
  onOpenSidePanelForBio: (personId: string) => void;
  /** Opens the existing PersonSidePanel (no focus). */
  onSelectPerson: (personId: string) => void;
}

export function NudgesPanelContainer({
  treeId,
  refetchSignal,
  existingPersonNamesHe,
  onCommitProposal,
  onOpenSidePanelForBio,
  onSelectPerson,
}: NudgesPanelContainerProps) {
  const { nudges, totalAvailable: nudgeCount, refetch, skip, removeLocally } = useNudges({
    treeId,
    refetchSignal,
  });

  const {
    proposals,
    status: discoveryStatus,
    error: discoveryError,
    discover,
    dismissProposal,
    removeProposal,
    resetError,
  } = useFamilyDiscovery({ treeId, existingPersonNamesHe });

  const [isAddingAll, setIsAddingAll] = useState(false);

  const totalAvailable = nudgeCount + proposals.length;

  const { state, hydrated, open, minimize } = usePanelState(totalAvailable > 0);

  const handleSavedAndDone = useCallback(
    (nudgeId: string) => {
      removeLocally(nudgeId);
      void refetch();
    },
    [refetch, removeLocally],
  );

  const handleCommitProposal = useCallback(
    async (proposal: FamilyMemberProposalDto) => {
      const ok = await onCommitProposal(proposal);
      if (ok) {
        removeProposal(proposal.dedupeKey);
        void refetch();
      }
      return ok;
    },
    [onCommitProposal, refetch, removeProposal],
  );

  const handleDiscoveryRetry = useCallback(() => {
    resetError();
    void discover();
  }, [discover, resetError]);

  const handleCommitAllProposals = useCallback(async () => {
    if (isAddingAll || proposals.length === 0) return;
    setIsAddingAll(true);
    const snapshot = [...proposals];

    try {
      let anySucceeded = false;
      for (const proposal of snapshot) {
        const ok = await onCommitProposal(proposal);
        if (!ok) break;
        removeProposal(proposal.dedupeKey);
        anySucceeded = true;
      }
      if (anySucceeded) {
        void refetch();
      }
    } finally {
      setIsAddingAll(false);
    }
  }, [isAddingAll, proposals, onCommitProposal, removeProposal, refetch]);

  const visibleCount = useMemo(() => {
    const combined = proposals.length + nudgeCount;
    return combined > 9 ? 9 : combined;
  }, [proposals.length, nudgeCount]);

  if (!hydrated) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-30"
      aria-hidden={state === 'minimized'}
    >
      <div className="pointer-events-auto absolute bottom-4 left-4">
        {state === 'open' ? (
          <NudgesPanel
            treeId={treeId}
            nudges={nudges}
            proposals={proposals}
            visibleCount={visibleCount}
            discoveryStatus={discoveryStatus}
            discoveryError={discoveryError}
            onDiscover={() => void discover()}
            onDiscoveryRetry={handleDiscoveryRetry}
            onCommitProposal={handleCommitProposal}
            onCommitAllProposals={() => void handleCommitAllProposals()}
            isAddingAll={isAddingAll}
            onDismissProposal={dismissProposal}
            onMinimize={minimize}
            onSavedAndDone={handleSavedAndDone}
            onSkip={skip}
            onOpenSidePanelForBio={onOpenSidePanelForBio}
            onSelectPerson={onSelectPerson}
          />
        ) : (
          <NudgesPanelBubble count={totalAvailable} onClick={open} />
        )}
      </div>
    </div>
  );
}
