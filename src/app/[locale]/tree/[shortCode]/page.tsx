import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { EmptyTreeState } from '@/components/features/tree/EmptyTreeState';
import { TreeCanvasWithModals } from '@/features/family-tree/components/TreeCanvasWithModals';
import {
  resolveTreePageDataBySlug,
  type TreePageData,
} from '@/server/services/tree.service';
import { JoinWelcomeBanner } from '@/components/features/tree/JoinWelcomeBanner';
import { RequestEditorAccessButton } from '@/components/features/tree/RequestEditorAccessButton';
import { PendingMembersPanel } from '@/components/features/tree/PendingMembersPanel';

type TreeShortCodePageProps = {
  params: Promise<{ locale: string; shortCode: string }>;
  searchParams: Promise<{
    about?: string | string[];
    focus?: string | string[];
    welcome?: string | string[];
  }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('treePage');
  return { title: t('title') };
}

export default async function TreeShortCodePage({
  params,
  searchParams,
}: TreeShortCodePageProps) {
  const { locale, shortCode } = await params;
  const sp = await searchParams;
  const dir = locale === 'he' ? 'rtl' : 'ltr';
  let treeData: TreePageData;
  try {
    treeData = await resolveTreePageDataBySlug(shortCode);
  } catch {
    const t = await getTranslations('treePage');
    return (
      <TreeShell>
        <div
          className="flex flex-1 items-center justify-center px-4 py-20 text-center text-slate-500"
          dir={dir}
        >
          {t('loadError')}
        </div>
      </TreeShell>
    );
  }

  // Per-tree role drives every UI affordance — no global gate.
  const treeRole = treeData.membershipRole;
  const canEditTree = treeRole === 'EDITOR' || treeRole === 'OWNER';
  const canEditAbout = canEditTree;
  const canDeletePerson = treeRole === 'OWNER';
  const openAboutRaw = sp?.about;
  const openAboutOnLoad =
    openAboutRaw === '1' ||
    openAboutRaw === 'true' ||
    (Array.isArray(openAboutRaw) &&
      (openAboutRaw[0] === '1' || openAboutRaw[0] === 'true'));
  const welcomeRaw = sp?.welcome;
  const showWelcomeBanner =
    welcomeRaw === '1' ||
    welcomeRaw === 'true' ||
    (Array.isArray(welcomeRaw) &&
      (welcomeRaw[0] === '1' || welcomeRaw[0] === 'true'));
  const treeDisplayName = treeData.treeName ?? shortCode;

  const focusRaw = sp?.focus;
  const initialSidePersonId =
    typeof focusRaw === 'string' && focusRaw.length > 0
      ? focusRaw
      : Array.isArray(focusRaw) && focusRaw[0]
        ? focusRaw[0]
        : null;

  if (!treeData.treeId) {
    return (
      <TreeShell>
        <EmptyTreeState mode="noTree" />
      </TreeShell>
    );
  }

  return (
    <TreeShell>
      <div className="flex min-h-0 flex-1 flex-col">
        {showWelcomeBanner && (
          <JoinWelcomeBanner treeName={treeDisplayName} />
        )}
        {treeRole === 'OWNER' && (
          <PendingMembersPanel treeId={treeData.treeId} />
        )}
        {treeData.viewerUserId != null &&
          (treeRole === null ||
            treeRole === 'VIEWER' ||
            treeRole === 'EDITOR_PENDING') && (
            <RequestEditorAccessButton
              treeId={treeData.treeId}
              initialRole={treeRole}
              ownerContact={treeData.ownerContact}
            />
          )}
        <div className="min-h-0 flex-1">
          <TreeCanvasWithModals
            key={shortCode}
            treeId={treeData.treeId}
            treeRouteCode={shortCode}
            initialPersons={treeData.initialPersons}
            initialRelationships={treeData.initialRelationships}
            initialFocalId={treeData.initialFocalId}
            initialPhotosByPerson={treeData.photosByPerson}
            canEdit={canEditTree}
            canDeletePerson={canDeletePerson}
            strictMode={treeData.strictLineageEnforcement}
            canEditAbout={canEditAbout}
            openAboutOnLoad={openAboutOnLoad}
            initialSidePersonId={initialSidePersonId}
          />
        </div>
      </div>
    </TreeShell>
  );
}

function TreeShell({ children }: { children: React.ReactNode }) {
  // flex-1 + min-h-0 lets this fill the leftover height inside the locked
  // viewport (set by the locale layout for the tree canvas route) and clip
  // overflow so only React Flow's +/- controls drive zoom — no browser scroll.
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {children}
    </div>
  );
}
