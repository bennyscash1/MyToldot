import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { TreeAboutBasicsEditor } from '@/features/about/components/TreeAboutBasicsEditor';
import { getCurrentUserTreeRole } from '@/lib/api/auth';
import { parseAboutImagesFromJson } from '@/lib/tree/about-images';
import { findTreeByRouteParam } from '@/server/services/tree.service';

type TreeAboutPageProps = {
  params: Promise<{ locale: string; shortCode: string }>;
};

export async function generateMetadata({ params }: TreeAboutPageProps): Promise<Metadata> {
  const { shortCode } = await params;
  const tree = await findTreeByRouteParam(shortCode);
  const t = await getTranslations('treeFamilyAboutPage');
  if (!tree) {
    return { title: t('metaTitleFallback') };
  }
  return { title: t('metaTitle', { name: tree.name }) };
}

export default async function TreeAboutPage({ params }: TreeAboutPageProps) {
  const { locale, shortCode } = await params;
  const dir = locale === 'he' ? 'rtl' : 'ltr';
  const tree = await findTreeByRouteParam(shortCode);
  if (!tree) notFound();

  const role = await getCurrentUserTreeRole(tree.id);
  const canEdit = role === 'EDITOR' || role === 'OWNER';
  const t = await getTranslations('treeFamilyAboutPage');
  const initialAboutImages = parseAboutImagesFromJson(tree.about_images) ?? [];

  return (
    <div className="min-h-0 flex-1 bg-[#f4f3e9]" dir={dir}>
      <header className="border-b border-slate-200/60 bg-white/80 px-4 py-6 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t('title', { name: tree.name })}
          </h1>
          <p className="mt-1 text-slate-600">{t('subtitle')}</p>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <TreeAboutBasicsEditor
          treeId={tree.id}
          initialName={tree.name}
          initialDescription={tree.description}
          initialMainSurnames={[...tree.main_surnames]}
          initialAboutImages={initialAboutImages}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
