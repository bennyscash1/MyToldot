'use client';

import { useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';

type JoinWelcomeBannerProps = {
  treeName: string;
};

export function JoinWelcomeBanner({ treeName }: JoinWelcomeBannerProps) {
  const t = useTranslations('joinFlow');
  const locale = useLocale();
  const dir = locale === 'he' ? 'rtl' : 'ltr';
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    router.replace(pathname);
  }, [router, pathname]);

  return (
    <div
      dir={dir}
      role="status"
      className="shrink-0 border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-900"
    >
      {t('welcomeBanner', { treeName })}
    </div>
  );
}
