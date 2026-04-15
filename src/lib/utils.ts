import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ──────────────────────────────────────────────
// cn — class-name helper.
// Merges Tailwind classes, resolving conflicts
// intelligently (e.g. "p-2 p-4" → "p-4").
// Usage: cn('base-class', condition && 'extra-class')
// ──────────────────────────────────────────────

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
