'use client';

import { useTranslations } from 'next-intl';

import type { FamilyDiscoveryStatus } from '../hooks/useFamilyDiscovery';

interface FamilyDiscoverySectionProps {
  status: FamilyDiscoveryStatus;
  error: string | null;
  onDiscover: () => void;
  onRetry: () => void;
  /** Hide the button while proposals are still pending review. */
  showButton: boolean;
}

export function FamilyDiscoverySection({
  status,
  error,
  onDiscover,
  onRetry,
  showButton,
}: FamilyDiscoverySectionProps) {
  const t = useTranslations('familyDiscovery');

  if (status === 'loading') {
    return (
      <div className="mb-3 space-y-2">
        <div
          className="h-8 animate-pulse rounded-lg bg-gray-100"
          aria-hidden
        />
        <p className="text-sm text-gray-600">{t('discovering')}</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="text-xs text-red-600">{error ?? t('errorGeneric')}</p>
        <button
          type="button"
          onClick={onRetry}
          className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
        >
          {t('retry')}
        </button>
      </div>
    );
  }

  if (!showButton) return null;

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={onDiscover}
        className="w-full rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-start text-sm font-medium text-emerald-700 transition hover:border-emerald-200 hover:bg-emerald-50"
      >
        {t('discoverButton')}
      </button>
    </div>
  );
}
