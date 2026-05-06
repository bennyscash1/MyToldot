'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/Button';
import { profileImagePublicUrl } from '@/lib/supabase/public-url';
import { TREE_ABOUT_IMAGES_MAX } from '@/lib/tree/about-images';
import { ServiceError } from '@/services/api.client';
import { storageService } from '@/services/storage.service';
import type { TreeAboutImageItem } from '@/types/api';

/** Uniform square thumbnail size (matches design: object-fit cover inside this box). */
const GALLERY_THUMB_PX = 280;

function sortImages(items: TreeAboutImageItem[]): TreeAboutImageItem[] {
  return [...items].sort((a, b) => a.order - b.order || a.path.localeCompare(b.path));
}

type TreeAboutImageGalleryProps = {
  treeId: string;
  items: TreeAboutImageItem[];
  onItemsChange: (next: TreeAboutImageItem[]) => void;
  canEdit: boolean;
  disabled: boolean;
};

export function TreeAboutImageGallery({
  treeId,
  items,
  onItemsChange,
  canEdit,
  disabled,
}: TreeAboutImageGalleryProps) {
  const t = useTranslations('treeFamilyAboutPage');
  const fileRef = useRef<HTMLInputElement>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const sorted = sortImages(items);
  const count = sorted.length;

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, closeLightbox]);

  const gridClass =
    count === 0
      ? ''
      : count === 1
        ? 'flex justify-center'
        : count === 2
          ? 'grid grid-cols-2 gap-6 justify-items-center'
          : 'grid grid-cols-1 gap-6 justify-items-center sm:grid-cols-2 lg:grid-cols-3';

  const thumbFrameClass =
    'relative mx-auto aspect-square w-full max-w-[280px] overflow-hidden rounded-lg bg-slate-100';

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !canEdit) return;
    setLocalError(null);
    if (sorted.length >= TREE_ABOUT_IMAGES_MAX) {
      setLocalError(t('galleryMaxImages', { max: TREE_ABOUT_IMAGES_MAX }));
      return;
    }
    setIsUploading(true);
    try {
      const { path } = await storageService.uploadTreeAboutImage(file, treeId);
      const next = [
        ...sorted,
        { path, caption: '', order: sorted.length },
      ].map((item, i) => ({ ...item, order: i }));
      onItemsChange(next);
    } catch (err) {
      setLocalError(
        err instanceof ServiceError ? err.message : t('galleryUploadError'),
      );
    } finally {
      setIsUploading(false);
    }
  }

  function updateCaption(index: number, caption: string) {
    const next = sorted.map((item, i) =>
      i === index ? { ...item, caption } : item,
    );
    onItemsChange(next);
  }

  function removeAt(index: number) {
    if (!window.confirm(t('deleteImageConfirm'))) return;
    const next = sorted
      .filter((_, i) => i !== index)
      .map((item, i) => ({ ...item, order: i }));
    onItemsChange(next);
  }

  function move(index: number, delta: number) {
    const j = index + delta;
    if (j < 0 || j >= sorted.length) return;
    const copy = [...sorted];
    [copy[index], copy[j]] = [copy[j], copy[index]];
    onItemsChange(copy.map((item, i) => ({ ...item, order: i })));
  }

  if (count === 0 && !canEdit) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">
          {t('galleryHeading')}
        </h2>
        {canEdit ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFile}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled || isUploading || sorted.length >= TREE_ABOUT_IMAGES_MAX}
              onClick={() => fileRef.current?.click()}
            >
              {isUploading ? t('galleryUploading') : t('addImage')}
            </Button>
          </>
        ) : null}
      </div>

      {localError ? (
        <p className="text-sm text-red-600" role="alert">
          {localError}
        </p>
      ) : null}

      {count > 0 ? (
        <div className={gridClass || undefined}>
          {sorted.map((item, index) => {
            const url = profileImagePublicUrl(item.path);
            if (!url) return null;
            return (
              <figure
                key={item.path}
                className="flex w-full max-w-[280px] flex-col gap-2"
              >
                <button
                  type="button"
                  onClick={() => setLightboxIndex(index)}
                  className={`${thumbFrameClass} block text-left focus:outline-none focus:ring-2 focus:ring-emerald-400`}
                  aria-label={t('openLightbox')}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    width={GALLERY_THUMB_PX}
                    height={GALLERY_THUMB_PX}
                    className="h-full w-full object-cover"
                  />
                </button>
                {canEdit ? (
                  <>
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        onClick={() => move(index, -1)}
                        disabled={disabled || index === 0}
                        className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-700 disabled:opacity-40"
                        aria-label={t('moveUp')}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => move(index, 1)}
                        disabled={disabled || index === sorted.length - 1}
                        className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-700 disabled:opacity-40"
                        aria-label={t('moveDown')}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeAt(index)}
                        disabled={disabled}
                        className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-700 disabled:opacity-40"
                      >
                        {t('deleteImage')}
                      </button>
                    </div>
                    <label className="sr-only" htmlFor={`caption-${item.path}`}>
                      {t('imageCaptionLabel')}
                    </label>
                    <input
                      id={`caption-${item.path}`}
                      type="text"
                      value={item.caption}
                      onChange={(e) => updateCaption(index, e.target.value)}
                      disabled={disabled}
                      placeholder={t('imageCaptionPlaceholder')}
                      maxLength={500}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:bg-gray-50"
                    />
                  </>
                ) : item.caption ? (
                  <figcaption className="text-center text-sm text-slate-600">
                    {item.caption}
                  </figcaption>
                ) : null}
              </figure>
            );
          })}
        </div>
      ) : canEdit ? (
        <p className="text-sm italic text-slate-400">{t('galleryEmptyHint')}</p>
      ) : null}

      {lightboxIndex !== null && sorted[lightboxIndex] ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t('lightboxTitle')}
          onClick={closeLightbox}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              closeLightbox();
            }}
            className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/20"
          >
            {t('lightboxClose')}
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={profileImagePublicUrl(sorted[lightboxIndex].path) ?? ''}
            alt=""
            className="max-h-[90vh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}
