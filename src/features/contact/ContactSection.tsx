'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  contactFormSchema,
  type ContactFormInput,
} from '@/features/contact/contact.schema';
import { cn } from '@/lib/utils';
import type { ApiEnvelope } from '@/types/api';

type FieldKey = keyof ContactFormInput;
type FormStatus = 'idle' | 'success' | 'error';

const EMPTY_FORM: ContactFormInput = {
  name: '',
  email: '',
  phone: '',
  message: '',
};

const TEXTAREA_CLASS =
  'w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400';

export interface ContactSectionProps {
  className?: string;
  /** Align heading block; about page uses start, landing uses center. */
  align?: 'center' | 'start';
}

function resolveSubmitError(
  code: string | undefined,
  t: ReturnType<typeof useTranslations<'contact'>>,
): string {
  if (code === 'EMAIL_SEND_FAILED') return t('errorSendFailed');
  if (code === 'VALIDATION_ERROR') return t('errorGeneric');
  return t('errorGeneric');
}

export function ContactSection({ className, align = 'center' }: ContactSectionProps) {
  const t = useTranslations('contact');

  const [form, setForm] = useState<ContactFormInput>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const setField = useCallback((field: FieldKey, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setStatus((prev) => {
      if (prev === 'idle') return prev;
      setErrorMessage(null);
      return 'idle';
    });
  }, []);

  const validateClient = useCallback((): ContactFormInput | null => {
    const parsed = contactFormSchema.safeParse(form);
    if (parsed.success) {
      setFieldErrors({});
      return parsed.data;
    }

    const messages: Record<FieldKey, string> = {
      name: t('validation.name'),
      email: t('validation.email'),
      phone: t('validation.phone'),
      message: t('validation.message'),
    };

    const nextErrors: Partial<Record<FieldKey, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && key in messages && !nextErrors[key as FieldKey]) {
        nextErrors[key as FieldKey] = messages[key as FieldKey];
      }
    }
    setFieldErrors(nextErrors);
    return null;
  }, [form, t]);

  const handleSubmit = useCallback(async () => {
    setErrorMessage(null);
    setStatus('idle');

    const data = validateClient();
    if (!data) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/v1/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const envelope = (await response.json()) as ApiEnvelope<{ sent: true }>;

      if (envelope.error) {
        setStatus('error');
        setErrorMessage(resolveSubmitError(envelope.error.code, t));
        return;
      }

      setForm(EMPTY_FORM);
      setFieldErrors({});
      setStatus('success');
    } catch {
      setStatus('error');
      setErrorMessage(t('errorGeneric'));
    } finally {
      setIsSubmitting(false);
    }
  }, [t, validateClient]);

  const headingAlign = align === 'start' ? 'text-start' : 'text-center';

  return (
    <section className={cn('mx-auto w-full max-w-md', className)}>
      <div className={cn('mb-5', headingAlign)}>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-[1.375rem]">
          {t('heading')}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
          {t('subheading')}
        </p>
      </div>

      <div className="flex flex-col gap-3.5">
        <Input
          label={t('fields.name')}
          name="contact-name"
          autoComplete="name"
          required
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          error={fieldErrors.name}
          disabled={isSubmitting}
          className="bg-white"
        />

        <Input
          label={t('fields.email')}
          name="contact-email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={(e) => setField('email', e.target.value)}
          error={fieldErrors.email}
          disabled={isSubmitting}
          className="bg-white"
        />

        <Input
          label={t('fields.phone')}
          name="contact-phone"
          type="tel"
          autoComplete="tel"
          required
          value={form.phone}
          onChange={(e) => setField('phone', e.target.value)}
          error={fieldErrors.phone}
          disabled={isSubmitting}
          className="bg-white"
        />

        <div className="flex flex-col gap-1">
          <label
            htmlFor="contact-message"
            className="text-sm font-medium text-gray-700"
          >
            {t('fields.message')}
            <span className="ms-1 text-red-500" aria-hidden="true">*</span>
          </label>
          <textarea
            id="contact-message"
            name="contact-message"
            rows={4}
            required
            value={form.message}
            onChange={(e) => setField('message', e.target.value)}
            disabled={isSubmitting}
            aria-invalid={fieldErrors.message ? true : undefined}
            aria-describedby={fieldErrors.message ? 'contact-message-error' : undefined}
            className={cn(
              TEXTAREA_CLASS,
              'min-h-[5.5rem] resize-y',
              fieldErrors.message
                ? 'border-red-400 focus:ring-red-400'
                : 'border-gray-300 focus:border-emerald-500 focus:ring-emerald-400',
            )}
          />
          {fieldErrors.message && (
            <p id="contact-message-error" className="text-xs text-red-500" role="alert">
              {fieldErrors.message}
            </p>
          )}
        </div>

        {status === 'success' && (
          <div
            role="status"
            className="rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-3 py-2.5 text-sm text-emerald-800"
          >
            {t('success')}
          </div>
        )}

        {status === 'error' && errorMessage && (
          <div
            role="alert"
            className="rounded-lg border border-rose-200/80 bg-rose-50/90 px-3 py-2.5 text-sm text-rose-800"
          >
            {errorMessage}
          </div>
        )}

        <div className="pt-0.5">
          <Button
            type="button"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? t('submitting') : t('submit')}
          </Button>
        </div>
      </div>
    </section>
  );
}
