import type { TreeMemberRole } from '@prisma/client';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';

export interface FamilyEntry {
  shortCode: string;
  name: string;
  role: TreeMemberRole;
}

const ROLE_BADGE: Record<TreeMemberRole, string> = {
  OWNER:          'bg-emerald-100 text-emerald-700',
  EDITOR:         'bg-blue-100 text-blue-700',
  EDITOR_PENDING: 'bg-amber-100 text-amber-800',
  VIEWER:         'bg-slate-100 text-slate-500',
};

const ROLE_KEY: Record<
  TreeMemberRole,
  'roleOwner' | 'roleEditor' | 'roleEditorPending' | 'roleViewer'
> = {
  OWNER:          'roleOwner',
  EDITOR:         'roleEditor',
  EDITOR_PENDING: 'roleEditorPending',
  VIEWER:         'roleViewer',
};

/**
 * Server component — renders a grid of family cards for users who belong to
 * two or more trees. Each card shows the family name, the user's role, and a
 * link to enter that tree.
 */
export async function FamilySelector({ families }: { families: FamilyEntry[] }) {
  const t = await getTranslations('familyHub');

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-8 w-8 text-emerald-600"
              aria-hidden="true"
            >
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            {t('title')}
          </h1>
          <p className="mt-2 text-gray-500">{t('subtitle')}</p>
        </div>

        {/* Family cards */}
        <ul className="grid gap-4 sm:grid-cols-2" role="list">
          {families.map((family) => (
            <li key={family.shortCode}>
              <Link
                href={`/tree/${family.shortCode}`}
                className="group flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-sm backdrop-blur-sm transition-all hover:border-emerald-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-base font-semibold leading-snug text-slate-900 group-hover:text-emerald-700">
                    {family.name}
                  </h2>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_BADGE[family.role]}`}
                  >
                    {t(ROLE_KEY[family.role])}
                  </span>
                </div>

                <p className="font-mono text-xs text-slate-400">#{family.shortCode}</p>

                <span className="mt-auto self-start rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 transition-colors group-hover:bg-emerald-100">
                  {t('enterTree')} →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
