import Image from 'next/image';
import { headers } from 'next/headers';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import type { NavItem } from '@/types';
import { prisma } from '@/lib/prisma';
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

/**
 * Reads the current pathname from the middleware-injected 'x-pathname' header,
 * extracts a 4-digit shortCode, and returns the matching tree name.
 * Returns null on any non-tree page or if the DB lookup finds nothing.
 */
async function getCurrentTreeName(): Promise<string | null> {
  try {
    const hdrs = await headers();
    const pathname = hdrs.get('x-pathname') ?? '';
    const match = pathname.match(/\/tree\/(\d{5})(?:\/|$)/);
    if (!match) return null;

    const tree = await prisma.tree.findUnique({
      where: { shortCode: match[1] },
      select: { name: true },
    });
    return tree?.name ?? null;
  } catch {
    return null;
  }
}

export async function Navbar() {
  const locale = await getLocale();
  const t = await getTranslations('nav');
  const tCommon = await getTranslations('common');
  const isHebrew = locale === 'he';
  const logoSrc = isHebrew ? '/images/LOGO-he.png' : '/images/LOGO-en.png';
  const logoAlt = isHebrew ? 'תולדותיי' : 'Toldotay';

  const treeName = await getCurrentTreeName();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/60 bg-[#f4f3e9]/95 backdrop-blur-sm">
      <nav
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
        aria-label="Main navigation"
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

          {/* Family name pill — visible only on /tree/[shortCode] pages */}
          {treeName && (
            <li>
              <span
                className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
                aria-label={`Current family: ${treeName}`}
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
                {treeName}
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
