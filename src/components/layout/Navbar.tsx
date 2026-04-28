import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
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
  { labelKey: 'tree', href: '/tree' },
  { labelKey: 'about', href: '/about' },
];

export function Navbar() {
  const locale  = useLocale();
  const t       = useTranslations('nav');
  const tCommon = useTranslations('common');
  const isHebrew = locale === 'he';
  const logoSrc = isHebrew ? '/images/LOGO-he.png' : '/images/LOGO-en.png';
  const logoAlt = isHebrew ? 'תולדותיי' : 'Toldotay';

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
