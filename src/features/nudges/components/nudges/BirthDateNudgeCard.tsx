'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { personsService } from '@/services/persons.service';
import { ServiceError } from '@/services/api.client';
import { DateInput } from '@/components/ui/DateInput';
import type { Nudge } from '../../lib/nudge-types';
import { pickStableTemplate } from '../../lib/nudge-messages';
import { dateToIsoDay } from '../../lib/date-format';
import { NudgeCardShell } from './NudgeCardShell';

interface Props {
  nudge: Nudge;
  onSavedAndDone: () => void;
  onSkip: () => void;
  onSelectPerson?: () => void;
}

const SAVED_FLASH_MS = 1500;

export function BirthDateNudgeCard({ nudge, onSavedAndDone, onSkip, onSelectPerson }: Props) {
  const t = useTranslations('nudges');
  const tMessages = useTranslations('nudges.messages');
  const [date, setDate] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [slidingOut, setSlidingOut] = useState(false);

  const templates = useMemo(() => {
    const raw = tMessages.raw('birthDate');
    return Array.isArray(raw) ? (raw as string[]) : [];
  }, [tMessages]);

  const prompt = pickStableTemplate(nudge.id, templates).replace(
    '{name}',
    nudge.person_name_he,
  );

  const today = useMemo(() => new Date(), []);

  const handleSave = async () => {
    if (!date || isSaving) return;
    setError(null);
    setIsSaving(true);
    try {
      await personsService.update(nudge.person_id, { birth_date: dateToIsoDay(date) });
      setSavedFlash(true);
      setTimeout(() => {
        setSlidingOut(true);
        setTimeout(onSavedAndDone, 220);
      }, SAVED_FLASH_MS);
    } catch (e) {
      const msg = e instanceof ServiceError ? e.message : 'Save failed';
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    setSlidingOut(true);
    setTimeout(onSkip, 220);
  };

  return (
    <NudgeCardShell
      personName={nudge.person_name_he}
      prompt={prompt}
      onSelectPerson={onSelectPerson}
      onSkip={handleSkip}
      savedFlash={savedFlash}
      slidingOut={slidingOut}
      inputArea={
        <div className="flex flex-col gap-1">
          <DateInput
            value={date}
            onChange={setDate}
            max={today}
            disabled={isSaving}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      }
      primaryAction={
        <button
          type="button"
          onClick={handleSave}
          disabled={!date || isSaving}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('save')}
        </button>
      }
    />
  );
}
