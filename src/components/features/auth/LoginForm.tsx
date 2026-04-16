'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { Input }  from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { authService } from '@/services/auth.service';
import { ServiceError } from '@/services/api.client';

// ──────────────────────────────────────────────
// LoginForm — Client Component
//
// Handles the email + password login flow:
//  1. Client-side validation (empty fields)
//  2. POST /api/v1/auth/login via authService
//  3. On success → redirect to "/" (home)
//  4. On failure → inline error message
//
// The parent page Server Component redirects
// authenticated users away so this form never
// mounts for an already-logged-in user.
// ──────────────────────────────────────────────

export function LoginForm() {
  const t      = useTranslations('auth');
  const router = useRouter();

  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [error, setError]           = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Basic client-side guard.
    if (!email.trim() || !password) {
      setError(t('errorRequired'));
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await authService.login(email.trim(), password);
      // Redirect to home — the home page will show the appropriate
      // content based on the user's tree state.
      router.push('/');
      router.refresh(); // Ensure server components re-render with new session.
    } catch (err) {
      if (err instanceof ServiceError) {
        // 401 → invalid credentials; surface a friendly message.
        setError(
          err.status === 401
            ? t('errorInvalidCredentials')
            : err.message,
        );
      } else {
        setError(t('errorGeneric'));
      }
    } finally {
      setSubmitting(false);
    }
  }

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
        label={t('email')}
        type="email"
        placeholder={t('emailPlaceholder')}
        value={email}
        autoComplete="email"
        autoFocus
        required
        onChange={(e) => { setEmail(e.target.value); setError(null); }}
      />

      <Input
        label={t('password')}
        type="password"
        placeholder={t('passwordPlaceholder')}
        value={password}
        autoComplete="current-password"
        required
        onChange={(e) => { setPassword(e.target.value); setError(null); }}
      />

      <Button type="submit" isLoading={isSubmitting} size="lg" className="w-full">
        {isSubmitting ? t('loggingIn') : t('loginButton')}
      </Button>

      <p className="text-center text-sm text-gray-500">
        {t('noAccount')}{' '}
        <Link
          href="/signup"
          className="font-medium text-emerald-600 hover:text-emerald-700 underline-offset-2 hover:underline"
        >
          {t('signupLink')}
        </Link>
      </p>
    </form>
  );
}
