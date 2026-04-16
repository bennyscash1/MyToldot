'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { Input }  from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { authService } from '@/services/auth.service';
import { ServiceError } from '@/services/api.client';

// ──────────────────────────────────────────────
// SignupForm — Client Component
//
// Handles new account creation:
//  1. Client-side validation (required, password length,
//     password confirmation match)
//  2. POST /api/v1/auth/signup via authService
//  3. On success → redirect to /setup-root (onboarding)
//  4. On failure → inline error message
// ──────────────────────────────────────────────

export function SignupForm() {
  const t      = useTranslations('auth');
  const router = useRouter();

  const [fullName, setFullName]         = useState('');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [confirmPassword, setConfirm]   = useState('');
  const [error, setError]               = useState<string | null>(null);
  const [isSubmitting, setSubmitting]   = useState(false);

  function validate(): string | null {
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      return t('errorRequired');
    }
    if (password.length < 8) {
      return t('errorPasswordLength');
    }
    if (password !== confirmPassword) {
      return t('errorPasswordMismatch');
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await authService.signup(email.trim(), password, fullName.trim());
      // After signup the user has an active session — take them to onboarding.
      router.push('/setup-root');
      router.refresh();
    } catch (err) {
      if (err instanceof ServiceError) {
        setError(
          err.status === 409
            ? t('errorEmailExists')
            : err.message,
        );
      } else {
        setError(t('errorGeneric'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const clearError = () => setError(null);

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {/* Global error banner */}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <Input
        label={t('fullName')}
        type="text"
        placeholder={t('fullNamePlaceholder')}
        value={fullName}
        autoComplete="name"
        autoFocus
        required
        onChange={(e) => { setFullName(e.target.value); clearError(); }}
      />

      <Input
        label={t('email')}
        type="email"
        placeholder={t('emailPlaceholder')}
        value={email}
        autoComplete="email"
        required
        onChange={(e) => { setEmail(e.target.value); clearError(); }}
      />

      <Input
        label={t('password')}
        type="password"
        placeholder={t('passwordPlaceholder')}
        value={password}
        autoComplete="new-password"
        required
        hint={t('passwordHint')}
        onChange={(e) => { setPassword(e.target.value); clearError(); }}
      />

      <Input
        label={t('confirmPassword')}
        type="password"
        placeholder={t('confirmPasswordPlaceholder')}
        value={confirmPassword}
        autoComplete="new-password"
        required
        onChange={(e) => { setConfirm(e.target.value); clearError(); }}
      />

      <Button type="submit" isLoading={isSubmitting} size="lg" className="w-full">
        {isSubmitting ? t('signingUp') : t('signupButton')}
      </Button>

      <p className="text-center text-sm text-gray-500">
        {t('hasAccount')}{' '}
        <Link
          href="/login"
          className="font-medium text-emerald-600 hover:text-emerald-700 underline-offset-2 hover:underline"
        >
          {t('loginLink')}
        </Link>
      </p>
    </form>
  );
}
