'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { PhotoLightbox } from '@/features/family-tree/components/panels/PhotoLightbox';
import type { PersonPhotoDTO } from '@/features/family-tree/lib/types';
import type { RecentPhoto } from '../types';

interface RecentGalleryPanelProps {
  photos: RecentPhoto[];
  totalPhotoCount: number;
  treeId: string;
}

const GRID_SIZE = 6;

export function RecentGalleryPanel({
  photos,
  totalPhotoCount,
  treeId,
}: RecentGalleryPanelProps) {
  const t = useTranslations('dashboard.panels');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const overflow = totalPhotoCount - GRID_SIZE;
  const showOverflowTile = overflow > 0 && photos.length >= GRID_SIZE;

  return (
    <section className="rounded-lg border border-slate-200/70 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">
        {t('recentPhotos')}
      </h2>
      {photos.length === 0 ? (
        <p className="rounded-md bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
          {t('noPhotos')}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.slice(0, showOverflowTile ? GRID_SIZE - 1 : GRID_SIZE).map((p, i) => (
            <button
              key={p.photoId}
              type="button"
              onClick={() => setActiveIndex(i)}
              className="group relative aspect-square overflow-hidden rounded-md border border-slate-200 bg-slate-100"
              title={p.personName}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.caption ?? p.personName}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                {p.personName}
              </span>
            </button>
          ))}
          {showOverflowTile && (
            <div className="flex aspect-square items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-600">
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
          onSaveCaption={async () => {
            /* read-only on dashboard */
          }}
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
