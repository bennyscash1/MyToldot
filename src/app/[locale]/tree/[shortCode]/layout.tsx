import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/routing';
import { TreeAboutOrBackLink } from '@/components/features/tree/TreeAboutOrBackLink';
import { getCurrentUserTreeRole } from '@/lib/api/auth';
import { findTreeByRouteParam } from '@/server/services/tree.service';

type TreeShortCodeLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string; shortCode: string }>;
};

export default async function TreeShortCodeLayout({
  children,
  params,
}: TreeShortCodeLayoutProps) {
  const { locale, shortCode } = await params;
  const hdrs = await headers();
  const pathname = hdrs.get('x-pathname') ?? '';
  const isDashboard = /\/tree\/\d{5}\/dashboard(?:\/|$)/.test(pathname);

  if (isDashboard) {
    return <div className="flex min-h-0 flex-1 flex-col">{children}</div>;
  }

  const t = await getTranslations('treeNav');
  const tManage = await getTranslations('familyManage');
  const tDashboard = await getTranslations('dashboard');

  const tree = await findTreeByRouteParam(shortCode);
  const familyLabel = tree?.name ?? shortCode;
  const isOwner =
    tree != null && (await getCurrentUserTreeRole(tree.id)) === 'OWNER';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav
        className="shrink-0 border-b border-slate-200/60 bg-[#f4f3e9] px-4 py-2 text-sm text-slate-600"
        aria-label={t('breadcrumbLabel')}
        dir={locale === 'he' ? 'rtl' : 'ltr'}
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <ol className="flex min-w-0 flex-wrap items-center gap-1.5">
            <li>
              <Link
                href="/"
                className="font-medium text-emerald-700 hover:text-emerald-800"
              >
                {t('home')}
              </Link>
            </li>
            <li aria-hidden="true" className="text-slate-400">
              /
            </li>
            <li className="font-medium text-slate-800">
              <Link href={`/tree/${shortCode}`} className="hover:text-emerald-800">
                {familyLabel}
              </Link>
            </li>
          </ol>
          <div className="inline-flex shrink-0 items-center gap-2">
            <Link
              href={`/tree/${shortCode}/dashboard`}
              aria-label={tDashboard('navbarLink')}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-600 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 shadow-sm transition-colors hover:border-emerald-700 hover:bg-emerald-100 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            >
              <SparkleIcon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">{tDashboard('navbarLink')}</span>
            </Link>
            <TreeAboutOrBackLink shortCode={shortCode} familyLabel={familyLabel} />
            {isOwner && (
              <Link
                href={`/tree/${shortCode}/manage`}
                aria-label={tManage('navManageFamily')}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border text-sm font-medium shadow-sm transition-colors hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400"
              >
                <GearIcon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="hidden sm:inline">{tManage('navManageFamily')}</span>
              </Link>
            )}
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2.5a.75.75 0 0 1 .7.48l1.6 4.16a4 4 0 0 0 2.36 2.36l4.16 1.6a.75.75 0 0 1 0 1.4l-4.16 1.6a4 4 0 0 0-2.36 2.36l-1.6 4.16a.75.75 0 0 1-1.4 0l-1.6-4.16a4 4 0 0 0-2.36-2.36l-4.16-1.6a.75.75 0 0 1 0-1.4l4.16-1.6a4 4 0 0 0 2.36-2.36l1.6-4.16a.75.75 0 0 1 .7-.48Z" />
    </svg>
  );
}

function GearIcon({ className }: { className?: string }) {
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
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
