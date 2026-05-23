'use client';

import type { Nudge } from '../lib/nudge-types';
import { BirthDateNudgeCard } from './nudges/BirthDateNudgeCard';
import { DeathDateNudgeCard } from './nudges/DeathDateNudgeCard';
import { PhotoNudgeCard } from './nudges/PhotoNudgeCard';
import { BioNudgeCard } from './nudges/BioNudgeCard';

interface NudgeCardProps {
  nudge: Nudge;
  treeId: string;
  onSavedAndDone: () => void;
  onSkip: () => void;
  onOpenSidePanelForBio: (personId: string) => void;
  onSelectPerson: (personId: string) => void;
}

export function NudgeCard({
  nudge,
  treeId,
  onSavedAndDone,
  onSkip,
  onOpenSidePanelForBio,
  onSelectPerson,
}: NudgeCardProps) {
  const handleSelectPerson = () => onSelectPerson(nudge.person_id);

  switch (nudge.type) {
    case 'birth_date':
      return (
        <BirthDateNudgeCard
          nudge={nudge}
          onSavedAndDone={onSavedAndDone}
          onSkip={onSkip}
          onSelectPerson={handleSelectPerson}
        />
      );
    case 'death_date':
      return (
        <DeathDateNudgeCard
          nudge={nudge}
          onSavedAndDone={onSavedAndDone}
          onSkip={onSkip}
          onSelectPerson={handleSelectPerson}
        />
      );
    case 'profile_image':
      return (
        <PhotoNudgeCard
          nudge={nudge}
          treeId={treeId}
          onSavedAndDone={onSavedAndDone}
          onSkip={onSkip}
          onSelectPerson={handleSelectPerson}
        />
      );
    case 'bio':
      return (
        <BioNudgeCard
          nudge={nudge}
          onOpenSidePanelForBio={() => onOpenSidePanelForBio(nudge.person_id)}
          onSkip={onSkip}
          onSelectPerson={handleSelectPerson}
        />
      );
    default: {
      const _exhaustive: never = nudge.type;
      return _exhaustive;
    }
  }
}
