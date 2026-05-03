import { getTranslations } from 'next-intl/server';
import { redirect }         from 'next/navigation';
import type { Metadata }    from 'next';
import type { LocalePageProps } from '@/types';
import { getAuthUser }      from '@/lib/api/auth';
import { Link }             from '@/i18n/routing';
import { LoginForm }        from '@/components/features/auth/LoginForm';

// ──────────────────────────────────────────────
// Login Page — Server Component
//
// URL: /[locale]/login
//
// If a session already exists, redirect to the home page; otherwise
// render the form. There is no global approval state — editing
// rights are enforced per-tree by TreeMember.role.
// ──────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: t('loginTitle') };
}

export default async function LoginPage({ params }: LocalePageProps) {
  const { locale } = await params;

  const user = await getAuthUser();
  if (user) {
    redirect(`/${locale}`);
  }

  const t = await getTranslations('auth');

  return (
    <AuthShell
      title={t('loginTitle')}
      subtitle={t('loginSubtitle')}
    >
      <LoginForm />
    </AuthShell>
  );
}

// ── Shared layout shell ───────────────────────

function AuthShell({
  title,
  subtitle,
  children,
}: {
  title:    string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-4 py-16">
      {/* Brand mark */}
      <div className="mb-8 text-center">
        <Link href="/" className="inline-block">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 transition-opacity hover:opacity-80">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-7 w-7 text-emerald-600"
              aria-hidden="true"
            >
              <path d="M12 2C9.243 2 7 4.243 7 7c0 1.669.825 3.143 2.083 4.059C7.834 11.748 7 13.278 7 15c0 2.757 2.243 5 5 5s5-2.243 5-5c0-1.722-.834-3.252-2.083-3.941C16.175 10.143 17 8.669 17 7c0-2.757-2.243-5-5-5zm0 16c-1.654 0-3-1.346-3-3s1.346-3 3-3 3 1.346 3 3-1.346 3-3 3zm0-8c-1.654 0-3-1.346-3-3s1.346-3 3-3 3 1.346 3 3-1.346 3-3 3z" />
            </svg>
          </div>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 text-gray-500">{subtitle}</p>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
        {children}
      </div>
    </div>
  );
}
