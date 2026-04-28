import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import type { LocalePageProps } from '@/types';
import { Link } from '@/i18n/routing';
import { getCurrentUserWithProfile } from '@/lib/api/auth';
import { PendingApprovalActions } from '@/components/features/auth/PendingApprovalActions';

// ──────────────────────────────────────────────
// /[locale]/pending-approval — landing for users
// who signed up but haven't been approved yet.
//
// Server Component:
//  • Anonymous → redirect to /login
//  • Approved (EDITOR/ADMIN) → redirect to /
//  • Otherwise → show the awaiting-approval card.
// ──────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: t('pendingTitle') };
}

export default async function PendingApprovalPage({ params }: LocalePageProps) {
  const { locale } = await params;

  const session = await getCurrentUserWithProfile();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  const profile = session.profile;
  const isApproved =
    !!profile?.is_approved && profile.access_role !== 'GUEST';
  if (isApproved) {
    redirect(`/${locale}`);
  }

  const t = await getTranslations('auth');

  return (
    <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-4 py-16">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="h-7 w-7 text-amber-600"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="text-xl font-bold tracking-tight text-amber-900 sm:text-2xl">
          {t('pendingHeading')}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-amber-800">
          {t('pendingMessage')}
        </p>

        {session.user.email && (
          <p className="mt-4 truncate rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-amber-900">
            <span className="font-medium">{t('signedInAs')}:</span> {session.user.email}
          </p>
        )}

        <PendingApprovalActions />

        <Link
          href="/"
          className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100"
        >
          {t('browseTree')}
        </Link>
      </div>
    </section>
  );
}
