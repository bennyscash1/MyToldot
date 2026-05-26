import Image from 'next/image';
import { headers } from 'next/headers';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import type { NavItem } from '@/types';
import { prisma } from '@/lib/prisma';
import { BrandMark } from '@/components/brand/BrandMark';
import { LanguageSwitcher } from './LanguageSwitcher';
import { NavbarActions } from './NavbarActions';

// ──────────────────────────────────────────────
// Navbar — Async Server Component.
//
// When the user is viewing a /tree/[shortCode] page, a small family-name
// pill is shown in the nav centre so it's always clear which tree is active.
// The pathname is injected by the middleware via the 'x-pathname' request
// header, so no client-side JS or React context is needed.
//
// Structure:
//   [Logo]    [Nav Links]  [Family pill?]    [Lang] [Auth]
// ──────────────────────────────────────────────

/** Navigation items. labelKey maps to messages/[locale].json nav.* */
const NAV_ITEMS: NavItem[] = [
  { labelKey: 'home', href: '/' },
  { labelKey: 'tree', href: '/tree' },
  { labelKey: 'about', href: '/about' },
];

interface TreeNavContext {
  name: string;
  shortCode: string;
  showDashboardLink: boolean;
}

const LANDING_ROOT_PATHNAME = /^\/(?:en|he)\/?$/;

/**
 * Reads the current pathname from the middleware-injected 'x-pathname' header,
 * extracts a 5-digit shortCode, and returns the matching tree context.
 * `showDashboardLink` is true on the main tree page and about page; false on
 * `/dashboard` itself and on `/manage`.
 * Returns null on any non-tree page or if the DB lookup finds nothing.
 */
async function getCurrentTreeContext(): Promise<TreeNavContext | null> {
  try {
    const hdrs = await headers();
    const pathname = hdrs.get('x-pathname') ?? '';
    const match = pathname.match(/\/tree\/(\d{5})(?:\/|$)/);
    if (!match) return null;

    const tree = await prisma.tree.findUnique({
      where: { shortCode: match[1] },
      select: { name: true, shortCode: true },
    });
    if (!tree) return null;

    const trailing = pathname.slice(pathname.indexOf(match[0]) + match[0].length);
    const showDashboardLink = !/^dashboard(?:\/|$)/.test(trailing) && !/^manage(?:\/|$)/.test(trailing);

    return {
      name: tree.name,
      shortCode: tree.shortCode,
      showDashboardLink,
    };
  } catch {
    return null;
  }
}

export async function Navbar() {
  const locale = await getLocale();
  const t = await getTranslations('nav');
  const tCommon = await getTranslations('common');
  const tLanding = await getTranslations({ locale, namespace: 'landing.navbar' });
  const isHebrew = locale === 'he';
  const logoSrc = isHebrew ? '/images/LOGO-he.png' : '/images/LOGO-en.png';
  const logoAlt = isHebrew ? 'תולדותיי' : 'Toldotay';
  const hdrs = await headers();
  const pathname = hdrs.get('x-pathname') ?? '';
  const isLandingRoot = LANDING_ROOT_PATHNAME.test(pathname);

  const treeContext = await getCurrentTreeContext();
  const tDashboard = await getTranslations('dashboard');

  if (isLandingRoot) {
    return (
      <header className="sticky top-0 z-50 w-full border-b border-paper-line bg-cream/90 backdrop-blur-[14px]">
        <nav
          className="mx-auto flex min-h-16 max-w-[1320px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8"
          aria-label={t('mainNavigationAria')}
        >
          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-85" aria-label="Toldotay">
            <BrandMark className="size-9" />
            <div className="text-start">
              <div className="font-serif text-[1.375rem] font-extrabold leading-none tracking-[-0.03em] text-brand-green-deep">
                TOLDOTAY
              </div>
              <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.3em] text-ink-muted">
                {tLanding('tagline')}
              </div>
            </div>
          </Link>

          <div className="hidden items-center gap-8 lg:flex">
            <a href="#blog" className="landing-nav-link text-sm font-medium text-ink-soft">{tLanding('blog')}</a>
            <a href="#features" className="landing-nav-link text-sm font-medium text-ink-soft">{tLanding('features')}</a>
            <a href="#scenario" className="landing-nav-link text-sm font-medium text-ink-soft">{tLanding('livingRoom')}</a>
            <Link href="/about" className="landing-nav-link text-sm font-medium text-ink-soft">{tLanding('about')}</Link>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <LanguageSwitcher variant="landing" />
            <Link
              href="/login"
              className="hidden px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-brand-green-deep sm:inline-flex"
            >
              {tLanding('login')}
            </Link>
            <Link
              href="/signup"
              className="inline-flex rounded-md border border-brand-green bg-brand-green px-4 py-2 text-sm font-semibold text-cream transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-green-deep"
            >
              {tLanding('createTree')}
            </Link>
          </div>
        </nav>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/60 bg-[#f4f3e9]/95 backdrop-blur-sm">
      <nav
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
        aria-label={t('mainNavigationAria')}
      >
        {/* ── Brand / Logo ── */}
        <Link
          href="/"
          className="flex items-center transition-opacity hover:opacity-80"
          aria-label={logoAlt}
        >
          <Image
            src={logoSrc}
            alt={logoAlt}
            width={260}
            height={56}
            className="h-12 w-auto sm:h-16"
            priority
          />
        </Link>

        {/* ── Navigation links + family pill ── */}
        <ul className="hidden items-center gap-1 md:flex" role="list">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              {item.disabled ? (
                <span
                  title={tCommon('comingSoon')}
                  className="cursor-not-allowed rounded-md px-3 py-2 text-sm font-medium text-gray-300"
                >
                  {t(item.labelKey as Parameters<typeof t>[0])}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
                >
                  {t(item.labelKey as Parameters<typeof t>[0])}
                </Link>
              )}
            </li>
          ))}

          {/* Dashboard view link — visible on tree pages, hidden on /dashboard and /manage */}
          {treeContext?.showDashboardLink && (
            <li>
              <Link
                href={`/tree/${treeContext.shortCode}/dashboard`}
                className="inline-flex items-center gap-1.5 rounded-full border-s-2 border-emerald-600 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-100"
              >
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
                {tDashboard('navbarLink')}
              </Link>
            </li>
          )}

          {/* Family name pill — visible only on /tree/[shortCode] pages */}
          {treeContext && (
            <li>
              <span
                className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
                aria-label={t('currentFamilyAria', { treeName: treeContext.name })}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-3.5 w-3.5 shrink-0"
                  aria-hidden="true"
                >
                  <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM1.49 15.326a.78.78 0 0 1-.358-.442 3 3 0 0 1 4.308-3.516 6.484 6.484 0 0 0-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 0 1-2.07-.655ZM16.44 15.98a4.97 4.97 0 0 0 2.07-.654.78.78 0 0 0 .357-.442 3 3 0 0 0-4.308-3.517 6.484 6.484 0 0 1 1.907 3.96 2.32 2.32 0 0 1-.026.654ZM18 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM5.304 16.19a.844.844 0 0 1-.277-.71 5 5 0 0 1 9.947 0 .843.843 0 0 1-.277.71A6.975 6.975 0 0 1 10 18a6.974 6.974 0 0 1-4.696-1.81Z" />
                </svg>
                {treeContext.name}
              </span>
            </li>
          )}
        </ul>

        {/* ── Right-side actions ── */}
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <NavbarActions />
        </div>
      </nav>
    </header>
  );
}
