'use client';

import { usePathname } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/routing';

const btnClass =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white/70 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm hover:border-emerald-300 hover:text-emerald-800';

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
    return (
      <Link href={`/tree/${shortCode}`} className={btnClass}>
        <BackChevronIcon className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden />
        <span>{t('backToTree')}</span>
      </Link>
    );
  }

  return (
    <Link href={`/tree/${shortCode}/about`} className={btnClass}>
      <InfoIcon className="h-4 w-4 shrink-0" aria-hidden />
      <span>{t('aboutWithFamily', { name: familyLabel })}</span>
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
