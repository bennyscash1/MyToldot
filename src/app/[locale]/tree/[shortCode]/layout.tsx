import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/routing';
import { findTreeByRouteParam } from '@/server/services/tree.service';

type TreeShortCodeLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string; shortCode: string }>;
};

export default async function TreeShortCodeLayout({
  children,
  params,
}: TreeShortCodeLayoutProps) {
  const { shortCode } = await params;
  const t = await getTranslations('treeNav');

  const tree = await findTreeByRouteParam(shortCode);
  const familyLabel = tree?.name ?? shortCode;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav
        className="shrink-0 border-b border-slate-200/60 bg-[#f4f3e9] px-4 py-2 text-sm text-slate-600"
        aria-label={t('breadcrumbLabel')}
        dir="rtl"
      >
        <ol className="mx-auto flex max-w-7xl flex-wrap items-center gap-1.5">
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
          <li className="font-medium text-slate-800" aria-current="page">
            {familyLabel}
          </li>
        </ol>
      </nav>
      {children}
    </div>
  );
}
