'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Input }   from '@/components/ui/Input';
import { Button }  from '@/components/ui/Button';
import { PersonForm } from './PersonForm';
import { treesService }   from '@/services/trees.service';
import { ServiceError }   from '@/services/api.client';
import type { PersonDto } from '@/types/api';

// ──────────────────────────────────────────────
// SetupRootFlow — Client Component
//
// A linear step-machine with two steps:
//
//  STEP 1 (conditional): "Name your tree"
//    → Only shown when the user has no tree yet.
//    → Calls POST /api/v1/trees, stores the new treeId.
//
//  STEP 2: "Add root person"
//    → Renders PersonForm with the resolved treeId.
//    → On success, shows a success screen + redirects.
//
// The parent Server Component pre-resolves the
// existing treeId (if any) so the user never sees
// Step 1 twice.
// ──────────────────────────────────────────────

type Step = 'name-tree' | 'add-person' | 'success';

interface SetupRootFlowProps {
  /** Null when the user has no tree yet. */
  initialTreeId:  string | null;
  initialTreeSlug?: string | null;
  strictMode:     boolean;
  /** Where to navigate after setup is complete. Defaults to '/tree/setup'. */
  redirectTo?:    string;
}

// ── Step indicator ────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const t = useTranslations('setup');
  const steps: { key: Step; label: string }[] = [
    { key: 'name-tree',  label: t('stepTreeLabel')   },
    { key: 'add-person', label: t('stepPersonLabel')  },
  ];

  const activeIndex = steps.findIndex((s) => s.key === current);

  return (
    <ol className="flex items-center gap-2 text-xs font-medium" aria-label="Setup progress">
      {steps.map((step, i) => {
        const done    = i < activeIndex;
        const active  = i === activeIndex;
        return (
          <li key={step.key} className="flex items-center gap-2">
            {i > 0 && (
              <span className={done ? 'text-emerald-400' : 'text-gray-300'} aria-hidden="true">
                ›
              </span>
            )}
            <span
              className={
                active ? 'text-emerald-600 font-semibold'
                : done  ? 'text-emerald-500'
                : 'text-gray-400'
              }
            >
              {done && <span className="me-1">✓</span>}
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// ── Step 1: Name the tree ─────────────────────

interface NameTreeStepProps {
  onCreated: (tree: { id: string; slug: string }) => void;
}

function NameTreeStep({ onCreated }: NameTreeStepProps) {
  const t = useTranslations('setup');

  const [name, setName]             = useState('');
  const [description, setDesc]      = useState('');
  const [error, setError]           = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError(t('treeErrorRequired')); return; }
    setError(null);
    setSubmitting(true);
    try {
      const tree = await treesService.create({
        name: name.trim(),
        description: description.trim() || undefined,
        is_public: false,
      });
      onCreated({ id: tree.id, slug: tree.slug });
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : t('treeErrorGeneric'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{t('treeStepTitle')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('treeStepSubtitle')}</p>
      </div>

      <Input
        label={t('treeName')}
        placeholder={t('treeNamePlaceholder')}
        value={name}
        onChange={(e) => { setName(e.target.value); setError(null); }}
        error={error ?? undefined}
        required
        autoFocus
        autoComplete="off"
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="tree-desc" className="text-sm font-medium text-gray-700">
          {t('treeDescription')}
        </label>
        <textarea
          id="tree-desc"
          rows={2}
          placeholder={t('treeDescriptionPlaceholder')}
          value={description}
          onChange={(e) => setDesc(e.target.value)}
          className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
      </div>

      <Button type="submit" isLoading={isSubmitting} size="lg" className="w-full">
        {isSubmitting ? t('creatingTree') : t('createTree')}
      </Button>
    </form>
  );
}

// ── Step 3: Success screen ────────────────────

function SuccessScreen({
  person,
  onAddAnother,
  redirectTo = '/tree/setup',
}: {
  person: PersonDto;
  onAddAnother: () => void;
  redirectTo?: string;
}) {
  const t      = useTranslations('setup');
  const router = useRouter();

  return (
    <div className="flex flex-col items-center gap-6 py-4 text-center">
      {/* Animated checkmark */}
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          className="h-10 w-10 text-emerald-600"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900">{t('successTitle')}</h2>
        <p className="mt-2 text-gray-600">
          <strong>
            {person.first_name}
            {person.last_name ? ` ${person.last_name}` : ''}
          </strong>{' '}
          {t('successSubtitle')}
        </p>
      </div>

      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <Button
          variant="secondary"
          size="lg"
          className="flex-1"
          onClick={onAddAnother}
        >
          {t('addAnother')}
        </Button>
        <Button
          size="lg"
          className="flex-1"
          onClick={() => router.push(redirectTo as Parameters<typeof router.push>[0])}
        >
          {t('viewTree')}
        </Button>
      </div>
    </div>
  );
}

// ── Main flow component ───────────────────────

export function SetupRootFlow({
  initialTreeId,
  initialTreeSlug = null,
  strictMode,
  redirectTo = '/tree/setup',
}: SetupRootFlowProps) {
  const t = useTranslations('setup');

  // Determine initial step based on whether a tree exists.
  const [step, setStep]           = useState<Step>(initialTreeId ? 'add-person' : 'name-tree');
  const [treeId, setTreeId]       = useState<string | null>(initialTreeId);
  const [treeSlug, setTreeSlug]   = useState<string | null>(initialTreeSlug);
  const [rootPerson, setRootPerson] = useState<PersonDto | null>(null);

  function handleTreeCreated(tree: { id: string; slug: string }) {
    setTreeId(tree.id);
    setTreeSlug(tree.slug);
    setStep('add-person');
  }

  function handlePersonCreated(person: PersonDto) {
    setRootPerson(person);
    setStep('success');
  }

  function handleAddAnother() {
    setRootPerson(null);
    setStep('add-person');
  }

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Step indicator — hidden on success */}
      {step !== 'success' && (
        <StepIndicator current={step} />
      )}

      {/* ── Step 1: Name the tree ── */}
      {step === 'name-tree' && (
        <NameTreeStep onCreated={handleTreeCreated} />
      )}

      {/* ── Step 2: Add root person ── */}
      {step === 'add-person' && treeId && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{t('personStepTitle')}</h2>
            <p className="mt-1 text-sm text-gray-500">{t('personStepSubtitle')}</p>
          </div>
          <PersonForm
            treeId={treeId}
            strictMode={strictMode}
            onSuccess={handlePersonCreated}
            onCancel={() => {
              // If we just came from the tree-naming step, go back.
              // If we arrived with an existing tree, we can't really "cancel" setup.
              if (!initialTreeId) setStep('name-tree');
            }}
          />
        </div>
      )}

      {/* ── Step 3: Success ── */}
      {step === 'success' && rootPerson && (
        <SuccessScreen
          person={rootPerson}
          onAddAnother={handleAddAnother}
          redirectTo={treeSlug ? `/tree/${treeSlug}` : redirectTo}
        />
      )}
    </div>
  );
}
