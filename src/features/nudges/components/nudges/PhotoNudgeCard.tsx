'use client';

import { useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { personsService } from '@/services/persons.service';
import { storageService } from '@/services/storage.service';
import { ServiceError } from '@/services/api.client';
import { profileImagePublicUrl } from '@/lib/supabase/public-url';
import type { Nudge } from '../../lib/nudge-types';
import { pickStableTemplate } from '../../lib/nudge-messages';
import { NudgeCardShell } from './NudgeCardShell';

interface Props {
  nudge: Nudge;
  treeId: string;
  onSavedAndDone: () => void;
  onSkip: () => void;
  onSelectPerson?: () => void;
}

const SAVED_FLASH_MS = 1500;

export function PhotoNudgeCard({
  nudge,
  treeId,
  onSavedAndDone,
  onSkip,
  onSelectPerson,
}: Props) {
  const t = useTranslations('nudges');
  const tMessages = useTranslations('nudges.messages');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [slidingOut, setSlidingOut] = useState(false);

  const templates = useMemo(() => {
    const raw = tMessages.raw('photo');
    return Array.isArray(raw) ? (raw as string[]) : [];
  }, [tMessages]);

  const prompt = pickStableTemplate(nudge.id, templates).replace(
    '{name}',
    nudge.person_name_he,
  );

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setIsUploading(true);
    try {
      const { path } = await storageService.uploadProfileImage(file, treeId, nudge.person_id);
      await personsService.update(nudge.person_id, { profile_image: path });
      setUploadedUrl(profileImagePublicUrl(path));
      setSavedFlash(true);
      setTimeout(() => {
        setSlidingOut(true);
        setTimeout(onSavedAndDone, 220);
      }, SAVED_FLASH_MS);
    } catch (err) {
      const msg = err instanceof ServiceError ? err.message : 'Upload failed';
      setError(msg);
    } finally {
      setIsUploading(false);
      // Reset the input so picking the same file again would refire.
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSkip = () => {
    setSlidingOut(true);
    setTimeout(onSkip, 220);
  };

  const inputArea = (
    <div className="flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      {isUploading && (
        <span className="text-sm text-gray-500">{t('uploading')}</span>
      )}
      {uploadedUrl && !isUploading && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={uploadedUrl}
          alt=""
          className="h-8 w-8 rounded-full object-cover ring-1 ring-emerald-200"
        />
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );

  return (
    <NudgeCardShell
      personName={nudge.person_name_he}
      prompt={prompt}
      onSelectPerson={onSelectPerson}
      onSkip={handleSkip}
      savedFlash={savedFlash}
      slidingOut={slidingOut}
      inputArea={inputArea}
      primaryAction={
        <button
          type="button"
          onClick={handlePickFile}
          disabled={isUploading || savedFlash}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CameraIcon className="h-4 w-4" />
          {t('uploadPhoto')}
        </button>
      }
    />
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
