'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { treesService } from '@/services/trees.service';
import { ServiceError } from '@/services/api.client';

// ──────────────────────────────────────────────
// SetupRootFlow — name + optional description,
// create tree, then navigate to /tree/[shortCode].
// First person is added on the empty tree canvas.
// ──────────────────────────────────────────────

function NameTreeStep() {
  const t = useTranslations('setup');
  const router = useRouter();

  const [name, setName] = useState('');
  const [description, setDesc] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('treeErrorRequired'));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const tree = await treesService.create({
        name: name.trim(),
        description: description.trim() || undefined,
        is_public: false,
      });
      router.push(`/tree/${tree.shortCode}`);
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
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
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

export function SetupRootFlow() {
  return (
    <div className="flex w-full flex-col gap-6">
      <NameTreeStep />
    </div>
  );
}
