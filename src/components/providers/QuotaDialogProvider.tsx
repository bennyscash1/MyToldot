'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { QuotaExceededDialog } from '@/components/ui/QuotaExceededDialog';
import { UsageScope, type UsageScopeValue } from '@/lib/usage/limits';

export interface QuotaDialogState {
  scope: UsageScopeValue;
  current: number;
  limit: number;
}

interface QuotaDialogContextValue {
  showQuotaDialog: (state: QuotaDialogState) => void;
  closeQuotaDialog: () => void;
}

const QuotaDialogContext = createContext<QuotaDialogContextValue | null>(null);

function isUsageScope(value: unknown): value is UsageScopeValue {
  return value === UsageScope.AI_BIOS || value === UsageScope.IMAGES;
}

function parseQuotaDetails(details?: Record<string, unknown>): QuotaDialogState | null {
  if (!details) return null;
  const { scope, current, limit } = details;
  if (!isUsageScope(scope)) return null;
  if (typeof current !== 'number' || typeof limit !== 'number') return null;
  return { scope, current, limit };
}

/** Returns true when the error was a quota limit and the dialog was opened. */
export function openQuotaFromError(
  showQuotaDialog: (state: QuotaDialogState) => void,
  error: { code: string; details?: Record<string, unknown> },
): boolean {
  if (error.code !== 'QUOTA_EXCEEDED') return false;
  const parsed = parseQuotaDetails(error.details);
  if (!parsed) return false;
  showQuotaDialog(parsed);
  return true;
}

export function QuotaDialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<QuotaDialogState | null>(null);

  const showQuotaDialog = useCallback((state: QuotaDialogState) => {
    setDialog(state);
  }, []);

  const closeQuotaDialog = useCallback(() => {
    setDialog(null);
  }, []);

  const value = useMemo(
    () => ({ showQuotaDialog, closeQuotaDialog }),
    [showQuotaDialog, closeQuotaDialog],
  );

  return (
    <QuotaDialogContext.Provider value={value}>
      {children}
      <QuotaExceededDialog
        open={dialog !== null}
        scope={dialog?.scope ?? null}
        current={dialog?.current ?? 0}
        limit={dialog?.limit ?? 0}
        onClose={closeQuotaDialog}
      />
    </QuotaDialogContext.Provider>
  );
}

export function useQuotaDialog(): QuotaDialogContextValue {
  const ctx = useContext(QuotaDialogContext);
  if (!ctx) {
    throw new Error('useQuotaDialog must be used within QuotaDialogProvider');
  }
  return ctx;
}
