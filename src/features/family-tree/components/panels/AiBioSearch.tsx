'use client';

import { useState } from 'react';

import { fetchAiBiographyAction } from '@/server/actions/person.actions';

interface AiBioSearchProps {
  personId: string;
  onApply: (text: string) => void;
}

export function AiBioSearch({ personId, onApply }: AiBioSearchProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchAiBiographyAction(personId);
      if (!result.ok) {
        setError(result.error.message || 'לא נמצא מידע. נסה שוב.');
        return;
      }

      const narrative = result.data.narrative.trim();
      if (!narrative) {
        setError('לא נמצא מידע. נסה שוב.');
        return;
      }

      onApply(narrative);
    } catch {
      setError('לא נמצא מידע. נסה שוב.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mb-4 flex flex-col gap-2">
      <button
        type="button"
        disabled={isLoading}
        onClick={() => void handleSearch()}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200/60 bg-[#fcdcd8] px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-[#fbc8c2] disabled:opacity-50"
      >
        {isLoading ? 'מחפש…' : 'חפש מידע'}
      </button>

      {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>}
    </div>
  );
}
