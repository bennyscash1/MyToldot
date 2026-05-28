'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { PhotoLightbox } from '@/features/family-tree/components/panels/PhotoLightbox';
import type { PersonPhotoDTO } from '@/features/family-tree/lib/types';
import type { RecentPhoto } from '../types';

interface GalleryPanelProps {
  photos: RecentPhoto[];
  totalPhotoCount: number;
  treeId: string;
  slots: number;
}

export function GalleryPanel({
  photos,
  totalPhotoCount,
  treeId,
  slots,
}: GalleryPanelProps) {
  const t = useTranslations('dashboard.panels');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const gridSlots = Math.min(6, Math.max(4, slots));
  const overflow = totalPhotoCount - gridSlots;
  const showOverflowTile = overflow > 0 && photos.length >= gridSlots;

  return (
    <section className="flex min-h-0 flex-col rounded-lg border border-slate-200/70 bg-white p-3 shadow-sm">
      <h2 className="mb-2 shrink-0 text-sm font-semibold text-slate-800">
        {t('recentPhotos')}
      </h2>
      {photos.length === 0 ? (
        <p className="rounded-md bg-slate-50 px-2 py-3 text-center text-xs text-slate-500">
          {t('noPhotos')}
        </p>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-1.5 sm:grid-cols-3">
          {photos
            .slice(0, showOverflowTile ? gridSlots - 1 : gridSlots)
            .map((p, i) => (
              <button
                key={p.photoId}
                type="button"
                onClick={() => setActiveIndex(i)}
                className="relative aspect-square overflow-hidden rounded-md border border-slate-200 bg-slate-100"
                title={p.personName}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.caption ?? p.personName}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          {showOverflowTile && (
            <div className="flex aspect-square items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              {t('moreCount', { n: overflow })}
            </div>
          )}
        </div>
      )}

      {activeIndex !== null && photos[activeIndex] && (
        <PhotoLightbox
          photo={toPhotoDTO(photos[activeIndex], treeId)}
          canEdit={false}
          open
          onClose={() => setActiveIndex(null)}
          onSaveCaption={async () => {}}
          isSaving={false}
        />
      )}
    </section>
  );
}

function toPhotoDTO(photo: RecentPhoto, treeId: string): PersonPhotoDTO {
  return {
    id: photo.photoId,
    person_id: photo.personId,
    tree_id: treeId,
    storage_path: photo.storagePath,
    caption: photo.caption,
    sort_order: 0,
    created_at: new Date().toISOString(),
  };
}
