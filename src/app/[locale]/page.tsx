import { useTranslations } from 'next-intl';
import type { Metadata } from 'next';
import type { LocalePageProps } from '@/types';

// ──────────────────────────────────────────────
// Home Page — Server Component.
// Phase 2 placeholder: displays translated hero copy.
// Interactive family tree content arrives in Phase 5.
// ──────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Home',
};

export default function HomePage(_props: LocalePageProps) {
  const t = useTranslations('home');

  return (
    <section className="flex flex-col items-center justify-center gap-6 px-4 py-24 text-center sm:py-36">
      {/* Decorative tree mark */}
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-9 w-9 text-emerald-600"
          aria-hidden="true"
        >
          <path d="M12 2C9.243 2 7 4.243 7 7c0 1.669.825 3.143 2.083 4.059C7.834 11.748 7 13.278 7 15c0 2.757 2.243 5 5 5s5-2.243 5-5c0-1.722-.834-3.252-2.083-3.941C16.175 10.143 17 8.669 17 7c0-2.757-2.243-5-5-5zm0 16c-1.654 0-3-1.346-3-3s1.346-3 3-3 3 1.346 3 3-1.346 3-3 3zm0-8c-1.654 0-3-1.346-3-3s1.346-3 3-3 3 1.346 3 3-1.346 3-3 3z" />
        </svg>
      </div>

      <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
        {t('title')}
      </h1>

      <p className="max-w-xl text-lg text-gray-500">{t('subtitle')}</p>

      {/* CTA placeholder — will link to /tree in Phase 5 */}
      <button
        disabled
        className="mt-2 cursor-not-allowed rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white opacity-50"
        title="Coming soon"
      >
        {t('cta')}
      </button>
    </section>
  );
}
