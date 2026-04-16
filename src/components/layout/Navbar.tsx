import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import type { NavItem } from '@/types';
import { LanguageSwitcher } from './LanguageSwitcher';
import { NavbarActions } from './NavbarActions';

// ──────────────────────────────────────────────
// Navbar — Server Component.
//
// All data resolution (translations, nav items)
// happens on the server. Only the LanguageSwitcher
// and NavbarActions are Client Components.
//
// Structure:
//   [Logo]         [Nav Links]        [Lang] [Auth]
//
// Tailwind uses logical properties (ms-/me-, ps-/pe-)
// so the layout flips automatically in RTL without
// any extra code.
// ──────────────────────────────────────────────

/** Navigation items. labelKey maps to messages/[locale].json nav.* */
const NAV_ITEMS: NavItem[] = [
  { labelKey: 'home', href: '/' },
  { labelKey: 'tree', href: '/tree', disabled: true }, // Phase 5
  { labelKey: 'about', href: '/about', disabled: true },
];

export function Navbar() {
  const t       = useTranslations('nav');
  const tCommon = useTranslations('common');

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/80 backdrop-blur-sm">
      <nav
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
        aria-label="Main navigation"
      >
        {/* ── Brand / Logo ── */}
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold text-gray-900 transition-opacity hover:opacity-80"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-6 w-6 text-emerald-600"
            aria-hidden="true"
          >
            <path d="M12 2C9.243 2 7 4.243 7 7c0 1.669.825 3.143 2.083 4.059C7.834 11.748 7 13.278 7 15c0 2.757 2.243 5 5 5s5-2.243 5-5c0-1.722-.834-3.252-2.083-3.941C16.175 10.143 17 8.669 17 7c0-2.757-2.243-5-5-5zm0 16c-1.654 0-3-1.346-3-3s1.346-3 3-3 3 1.346 3 3-1.346 3-3 3zm0-8c-1.654 0-3-1.346-3-3s1.346-3 3-3 3 1.346 3 3-1.346 3-3 3z" />
          </svg>
          <span>Family Tree</span>
        </Link>

        {/* ── Navigation links ── */}
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
