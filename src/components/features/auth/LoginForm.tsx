'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { Input }  from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { authService } from '@/services/auth.service';
import { ServiceError } from '@/services/api.client';

// ──────────────────────────────────────────────
// LoginForm — Client Component
//
// Handles the email + password login flow:
//  1. Client-side validation (empty fields)
//  2. POST /api/v1/auth/login via authService
//  3. On success → push to "/" so the user lands on the dashboard
//  4. On failure → inline error message
//
// There is no global approval gate; per-tree access is enforced
// inside the tree pages and server actions.
// ──────────────────────────────────────────────

export function LoginForm() {
  const t      = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [error, setError]           = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email.trim() || !password) {
      setError(t('errorRequired'));
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await authService.login(email.trim(), password);
      router.push('/');
      router.refresh();
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
      {(error || searchParams.get('error') === 'oauth_failed') && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error ??
            // GOOGLE AUTH ADDED: user-friendly callback failure message.
            'Google sign-in failed. Please try again or use email/password.'}
        </div>
      )}

      {/* GOOGLE AUTH ADDED */}
      <GoogleSignInButton />
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs uppercase tracking-wide text-gray-400">or</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

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
