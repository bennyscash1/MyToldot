'use client';

import { useCallback } from 'react';

import { useNudges } from '../hooks/useNudges';
import { usePanelState } from '../hooks/usePanelState';
import { NudgesPanel } from './NudgesPanel';
import { NudgesPanelBubble } from './NudgesPanelBubble';

interface NudgesPanelContainerProps {
  treeId: string;
  /** Bumped by the parent after a successful tree mutation. */
  refetchSignal: number;
  /** Opens the existing PersonSidePanel focused on the bio textarea. */
  onOpenSidePanelForBio: (personId: string) => void;
  /** Opens the existing PersonSidePanel (no focus). */
  onSelectPerson: (personId: string) => void;
}

export function NudgesPanelContainer({
  treeId,
  refetchSignal,
  onOpenSidePanelForBio,
  onSelectPerson,
}: NudgesPanelContainerProps) {
  const { nudges, totalAvailable, refetch, skip, removeLocally } = useNudges({
    treeId,
    refetchSignal,
  });

  const { state, hydrated, open, minimize } = usePanelState(totalAvailable > 0);

  const handleSavedAndDone = useCallback(
    (nudgeId: string) => {
      removeLocally(nudgeId);
      // Background refetch so the server-side state reconciles.
      void refetch();
    },
    [refetch, removeLocally],
  );

  // While the panel is still hydrating from localStorage we render nothing —
  // avoids a "bubble flash" before respecting the persisted preference.
  if (!hydrated) return null;

  // No nudges and minimized: render nothing at all (no zero badge).
  if (totalAvailable === 0 && state === 'minimized') return null;

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
            visibleCount={totalAvailable}
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
