'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/Button';
import { MAX_CAPTION_LENGTH } from '@/lib/images/gallery-upload-constraints';
import { personGalleryPublicUrl } from '@/lib/supabase/public-url';
import { cn } from '@/lib/utils';
import type { PersonPhotoDTO } from '@/features/family-tree/lib/types';

export interface PhotoLightboxProps {
  photo: PersonPhotoDTO;
  canEdit: boolean;
  open: boolean;
  onClose: () => void;
  onSaveCaption: (caption: string) => Promise<void>;
  isSaving: boolean;
}

export function PhotoLightbox({
  photo,
  canEdit,
  open,
  onClose,
  onSaveCaption,
  isSaving,
}: PhotoLightboxProps) {
  const t = useTranslations('gallery');
  const locale = useLocale();
  const dir = locale === 'he' ? 'rtl' : 'ltr';
  const [draftCaption, setDraftCaption] = useState(photo.caption ?? '');

  useEffect(() => {
    if (open) setDraftCaption(photo.caption ?? '');
  }, [open, photo.caption, photo.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const src = personGalleryPublicUrl(photo.storage_path);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        dir={dir}
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-xl"
        role="dialog"
        aria-modal
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute start-3 top-3 rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
          aria-label={t('close')}
        >
          ✕
        </button>

        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            className="mx-auto mt-6 max-h-[60vh] w-auto max-w-full rounded-lg object-contain"
          />
        ) : null}

        {canEdit ? (
          <div className="mt-4 flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">{t('editCaption')}</label>
            <textarea
              value={draftCaption}
              onChange={(e) => setDraftCaption(e.target.value.slice(0, MAX_CAPTION_LENGTH))}
              placeholder={t('captionPlaceholder')}
              rows={3}
              className={cn(
                'w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm',
                'focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500',
              )}
            />
            <p className="text-end text-xs text-gray-400">
              {draftCaption.length}/{MAX_CAPTION_LENGTH}
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
                {t('cancel')}
              </Button>
              <Button
                type="button"
                isLoading={isSaving}
                onClick={() => void onSaveCaption(draftCaption)}
              >
                {t('save')}
              </Button>
            </div>
          </div>
        ) : photo.caption ? (
          <p className="mt-4 text-center text-sm text-gray-700">{photo.caption}</p>
        ) : null}
      </div>
    </div>
  );
}
