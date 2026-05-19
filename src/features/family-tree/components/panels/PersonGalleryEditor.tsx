'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { MAX_PHOTOS_PER_PERSON } from '@/lib/images/gallery-upload-constraints';
import { personGalleryPublicUrl } from '@/lib/supabase/public-url';
import { cn } from '@/lib/utils';
import {
  removePersonPhotoAction,
  updatePersonPhotoCaptionAction,
} from '@/server/actions/person-photo.actions';
import { storageService } from '@/services/storage.service';
import { ServiceError } from '@/services/api.client';
import type { PersonPhotoDTO } from '@/features/family-tree/lib/types';

import { PhotoLightbox } from './PhotoLightbox';

export interface PersonGalleryEditorProps {
  treeId: string;
  personId: string;
  treeRouteCode: string;
  photos: PersonPhotoDTO[];
  onPhotosChange: (next: PersonPhotoDTO[]) => void;
  canEdit: boolean;
}

function PhotoIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

export function PersonGalleryEditor({
  treeId,
  personId,
  treeRouteCode,
  photos,
  onPhotosChange,
  canEdit,
}: PersonGalleryEditorProps) {
  const t = useTranslations('gallery');
  const locale = useLocale();
  const dir = locale === 'he' ? 'rtl' : 'ltr';

  const [open, setOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showMaxModal, setShowMaxModal] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<PersonPhotoDTO | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const count = photos.length;

  useEffect(() => {
    setOpen(false);
    setLocalError(null);
    setLightboxPhoto(null);
  }, [personId]);

  const handleUpload = (file: File) => {
    setLocalError(null);
    startTransition(async () => {
      try {
        const created = await storageService.uploadPersonGalleryImage(
          file,
          treeId,
          personId,
        );
        onPhotosChange([...photos, created]);
        setOpen(true);
      } catch (err) {
        if (err instanceof ServiceError && err.code === 'MAX_PHOTOS_REACHED') {
          setShowMaxModal(true);
          return;
        }
        setLocalError(
          err instanceof ServiceError ? err.message : t('errors.uploadFailed'),
        );
      }
    });
  };

  const handleDelete = (photo: PersonPhotoDTO) => {
    if (!window.confirm(t('confirmDelete'))) return;
    const prev = photos;
    onPhotosChange(photos.filter((p) => p.id !== photo.id));
    if (lightboxPhoto?.id === photo.id) setLightboxPhoto(null);

    startTransition(async () => {
      const result = await removePersonPhotoAction({
        photoId: photo.id,
        shortCode: treeRouteCode,
      });
      if (!result.ok) {
        onPhotosChange(prev);
        setLocalError(t('errors.deleteFailed'));
      }
    });
  };

  const handleSaveCaption = async (caption: string) => {
    if (!lightboxPhoto) return;
    const prev = photos;
    const nextCaption = caption.trim() || null;
    const optimistic = prev.map((p) =>
      p.id === lightboxPhoto.id ? { ...p, caption: nextCaption } : p,
    );
    onPhotosChange(optimistic);

    const result = await updatePersonPhotoCaptionAction({
      photoId: lightboxPhoto.id,
      caption,
      shortCode: treeRouteCode,
    });

    if (!result.ok) {
      onPhotosChange(prev);
      setLocalError(t('errors.captionFailed'));
      return;
    }

    setLightboxPhoto(result.data);
    onPhotosChange(prev.map((p) => (p.id === result.data.id ? result.data : p)));
  };

  const gridSlots = 5;
  const emptySlots = Math.max(0, gridSlots - count - (canEdit && count < MAX_PHOTOS_PER_PERSON ? 1 : 0));

  return (
    <div className="mb-4" dir={dir}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition',
          count > 0
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
            : 'border-gray-200 bg-white text-slate-700',
        )}
      >
        <PhotoIcon className="h-5 w-5 shrink-0 text-emerald-600" />
        <span className="flex-1 text-start font-medium">{t('title')}</span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-semibold',
            count > 0 ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600',
          )}
        >
          {count}
        </span>
        <span
          className={cn(
            'text-gray-400 transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        >
          ▾
        </span>
      </button>

      <div
        className={cn(
          'grid overflow-hidden transition-all duration-200',
          open ? 'mt-2 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="min-h-0 overflow-visible">
          <div className="rounded-lg border border-gray-200/80 bg-[#faf9f3] p-2.5">
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo) => {
                const src = personGalleryPublicUrl(photo.storage_path);
                return (
                  <div key={photo.id} className="relative aspect-square">
                    <button
                      type="button"
                      className="relative h-full w-full overflow-hidden rounded-lg border border-gray-200/60 bg-white"
                      onClick={() => setLightboxPhoto(photo)}
                    >
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={src}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                      {photo.caption ? (
                        <span
                          className="absolute bottom-1 end-1 text-[10px] font-bold text-white drop-shadow"
                          aria-hidden
                        >
                          •
                        </span>
                      ) : null}
                    </button>
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(photo);
                        }}
                        disabled={isPending}
                        className="absolute start-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-xs text-white hover:bg-red-600"
                        aria-label={t('delete')}
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                );
              })}

              {canEdit && count < MAX_PHOTOS_PER_PERSON ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => fileRef.current?.click()}
                  className={cn(
                    'flex aspect-square flex-col items-center justify-center rounded-lg',
                    'border-2 border-dashed border-emerald-300 bg-emerald-50',
                    'text-emerald-700 transition hover:bg-emerald-100',
                    'disabled:opacity-50',
                  )}
                >
                  <span className="text-2xl leading-none">+</span>
                  <span className="mt-0.5 text-[10px] font-medium">{t('addPhoto')}</span>
                </button>
              ) : null}

              {Array.from({ length: emptySlots }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="aspect-square rounded-lg border border-dashed border-gray-200/80 bg-white/40"
                  aria-hidden
                />
              ))}
            </div>

            <p className="mt-2 text-center text-xs text-gray-500">
              {t('count', { current: count, max: MAX_PHOTOS_PER_PERSON })}
              {count > 0 ? (
                <span className="mt-0.5 block text-[11px] text-gray-400">
                  {t('tapToEdit')}
                </span>
              ) : null}
            </p>

            {localError ? (
              <p className="mt-2 text-center text-xs text-red-600" role="alert">
                {localError}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) handleUpload(f);
        }}
      />

      {lightboxPhoto ? (
        <PhotoLightbox
          photo={lightboxPhoto}
          canEdit={canEdit}
          open={Boolean(lightboxPhoto)}
          onClose={() => setLightboxPhoto(null)}
          onSaveCaption={handleSaveCaption}
          isSaving={isPending}
        />
      ) : null}

      {showMaxModal ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowMaxModal(false);
          }}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 shadow-xl"
            role="alertdialog"
            dir={dir}
          >
            <p className="text-center text-sm text-slate-800">{t('errors.maxReached')}</p>
            <button
              type="button"
              className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              onClick={() => setShowMaxModal(false)}
            >
              {t('close')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
