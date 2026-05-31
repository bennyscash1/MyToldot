'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { searchPersonImagesAction } from '@/server/actions/person.actions';
import type { ImageCandidate } from '@/features/family-tree/schemas/person-image-search.schema';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { EXTERNAL_IMAGE_IMG_PROPS, normalizeExternalImageUrl } from '@/lib/images/normalize-external-image-url';
import { cn } from '@/lib/utils';

export interface AiImageSelection {
  profileUrl?: string;
  galleryItems?: Array<{ imageUrl: string; caption?: string }>;
}

export interface AiImageSearchModalProps {
  open: boolean;
  onClose: () => void;
  mode: 'profile' | 'gallery';
  personId: string;
  personName: string;
  birthDateLabel?: string;
  deathDateLabel?: string;
  defaultSearchContext: string;
  onApply: (selection: AiImageSelection) => void;
}

function confidenceClass(confidence: ImageCandidate['confidence']): string {
  switch (confidence) {
    case 'high':
      return 'bg-emerald-100 text-emerald-800';
    case 'medium':
      return 'bg-amber-100 text-amber-800';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

function CandidateImage({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const src = normalizeExternalImageUrl(url);

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xs text-slate-500">
        —
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="h-full w-full object-cover"
      {...EXTERNAL_IMAGE_IMG_PROPS}
      onError={() => setFailed(true)}
    />
  );
}

export function AiImageSearchModal({
  open,
  onClose,
  mode,
  personId,
  personName,
  birthDateLabel,
  deathDateLabel,
  defaultSearchContext,
  onApply,
}: AiImageSearchModalProps) {
  const t = useTranslations('aiImageSearch');
  const [searchContext, setSearchContext] = useState(defaultSearchContext);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ImageCandidate[]>([]);
  const [profileIndex, setProfileIndex] = useState<number | null>(null);
  const [gallerySelected, setGallerySelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!open) return;
    setSearchContext(defaultSearchContext);
    setError(null);
    setCandidates([]);
    setProfileIndex(null);
    setGallerySelected(new Set());
  }, [open, defaultSearchContext, personId]);

  const handleSearch = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await searchPersonImagesAction({
        personId,
        searchContext,
      });
      if (!result.ok) {
        setError(result.error.message || t('searchFailed'));
        return;
      }
      setCandidates(result.data.candidates);
      if (result.data.candidates.length === 0) {
        setError(t('noResults'));
      }
    } catch {
      setError(t('searchFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const toggleGallery = (index: number) => {
    setGallerySelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const canSave = useMemo(() => {
    if (mode === 'profile') return profileIndex !== null;
    return gallerySelected.size > 0 || profileIndex !== null;
  }, [mode, profileIndex, gallerySelected.size]);

  const handleSave = () => {
    const selection: AiImageSelection = {};
    if (profileIndex !== null && candidates[profileIndex]) {
      selection.profileUrl = normalizeExternalImageUrl(candidates[profileIndex].imageUrl);
    }
    if (gallerySelected.size > 0) {
      selection.galleryItems = Array.from(gallerySelected)
        .sort((a, b) => a - b)
        .map((i) => {
          const c = candidates[i];
          return {
            imageUrl: normalizeExternalImageUrl(c.imageUrl),
            caption: c.caption,
          };
        });
    }
    onApply(selection);
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] bg-slate-900/40"
        aria-label={t('close')}
        onClick={onClose}
      />
      <div
        className="fixed inset-x-4 top-[8vh] z-[70] mx-auto flex max-h-[84vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-[#f4f3e9] shadow-2xl"
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-image-search-title"
      >
        <div className="shrink-0 border-b border-slate-200/60 px-4 py-3">
          <h2 id="ai-image-search-title" className="text-center text-lg font-semibold text-slate-900">
            {t('title')}
          </h2>
          <p className="mt-1 text-center text-sm text-slate-600">{personName}</p>
          {(birthDateLabel || deathDateLabel) && (
            <p className="text-center text-xs text-slate-500">
              {[birthDateLabel, deathDateLabel].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        <LoadingOverlay isPending={isLoading} variant="ai-biography" className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <label className="mb-3 flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">{t('searchContext')}</span>
              <textarea
                rows={3}
                value={searchContext}
                onChange={(e) => setSearchContext(e.target.value)}
                className="w-full resize-y rounded-lg border border-slate-200/90 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600/40"
              />
            </label>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => void handleSearch()}
              className="mb-4 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {isLoading ? t('searching') : t('search')}
            </button>

            {error && (
              <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
            )}

            {candidates.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {candidates.map((candidate, index) => (
                  <div
                    key={`${candidate.imageUrl}-${index}`}
                    className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm"
                  >
                    <div className="relative aspect-square">
                      <CandidateImage url={candidate.imageUrl} alt="" />
                      <span
                        className={cn(
                          'absolute start-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium',
                          confidenceClass(candidate.confidence),
                        )}
                      >
                        {t(`confidence.${candidate.confidence}`)}
                      </span>
                    </div>
                    <div className="space-y-1.5 p-2">
                      <p className="truncate text-[10px] text-slate-500">{candidate.sourceDomain}</p>
                      {candidate.caption ? (
                        <p className="line-clamp-2 text-xs text-slate-700">{candidate.caption}</p>
                      ) : null}
                      <label className="flex items-center gap-1.5 text-xs">
                        <input
                          type="radio"
                          name="profile-pick"
                          checked={profileIndex === index}
                          onChange={() => setProfileIndex(index)}
                          className="accent-emerald-600"
                        />
                        {t('mainPhoto')}
                      </label>
                      {(mode === 'gallery' || mode === 'profile') && (
                        <label className="flex items-center gap-1.5 text-xs">
                          <input
                            type="checkbox"
                            checked={gallerySelected.has(index)}
                            onChange={() => toggleGallery(index)}
                            className="accent-emerald-600"
                          />
                          {t('addToGallery')}
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex shrink-0 gap-2 border-t border-slate-200/60 bg-[#f4f3e9] p-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={handleSave}
              className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {t('saveSelection')}
            </button>
          </div>
        </LoadingOverlay>
      </div>
    </>
  );
}
