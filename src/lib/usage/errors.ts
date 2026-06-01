import type { ApiErrorEnvelope } from '@/lib/api/response';

import { UsageLimit, UsageScope, type UsageScopeValue } from './limits';

export class QuotaExceededError extends Error {
  readonly code = 'QUOTA_EXCEEDED' as const;

  constructor(
    message: string,
    public readonly scope: UsageScopeValue,
    public readonly current: number,
    public readonly limit: number,
  ) {
    super(message);
    this.name = 'QuotaExceededError';
  }

  toEnvelope(): ApiErrorEnvelope {
    return {
      data: null,
      error: {
        code: this.code,
        message: this.message,
        details: {
          scope: this.scope,
          limit: this.limit,
          current: this.current,
        },
      },
    };
  }
}

export function aiQuotaExceeded(current: number): QuotaExceededError {
  return new QuotaExceededError(
    'Daily AI biography limit reached',
    UsageScope.AI_BIOS,
    current,
    UsageLimit.AI_BIOS_PER_USER_PER_DAY,
  );
}

export function imageQuotaExceeded(current: number): QuotaExceededError {
  return new QuotaExceededError(
    'Family image upload limit reached',
    UsageScope.IMAGES,
    current,
    UsageLimit.IMAGES_PER_TREE,
  );
}
