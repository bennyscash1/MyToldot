'use client';

import { usePathname } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/routing';

const btnClass =
  'inline-flex items-center gap-2 h-10 px-4 rounded-xl border text-sm font-medium shadow-sm transition-colors hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300';

/** On `/tree/:code/about`, shows “Back to tree”; otherwise “About {name}”. */
export function TreeAboutOrBackLink({
  shortCode,
  familyLabel,
}: {
  shortCode: string;
  familyLabel: string;
}) {
  const pathname = usePathname();
  const t = useTranslations('treeNav');
  const onAboutPage = /\/tree\/[^/]+\/about$/.test(pathname ?? '');

  if (onAboutPage) {
    const backLabel = t('backToTree');
    return (
      <Link href={`/tree/${shortCode}`} className={btnClass} aria-label={backLabel}>
        <BackChevronIcon className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden />
        <span className="hidden sm:inline">{backLabel}</span>
      </Link>
    );
  }

  const aboutLabel = t('aboutWithFamily', { name: familyLabel });
  return (
    <Link href={`/tree/${shortCode}/about`} className={btnClass} aria-label={aboutLabel}>
      <InfoIcon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="hidden sm:inline">{aboutLabel}</span>
    </Link>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 11v5" />
      <circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function BackChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
    </svg>
  );
}
