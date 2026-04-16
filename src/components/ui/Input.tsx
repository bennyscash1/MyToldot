import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

// ──────────────────────────────────────────────
// Input — dumb UI primitive.
// Wraps a native <input> with a label, optional
// hint text, and an error state. Fully RTL-aware
// via Tailwind logical-property classes.
// ──────────────────────────────────────────────

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?:     string;
  hint?:      string;
  error?:     string;
  /** Force RTL direction on this input regardless of the page locale.
   *  Use for Hebrew text fields. */
  forceRtl?:  boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, forceRtl, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-gray-700"
          >
            {label}
            {props.required && (
              <span className="ms-1 text-red-500" aria-hidden="true">*</span>
            )}
          </label>
        )}

        <input
          ref={ref}
          id={inputId}
          dir={forceRtl ? 'rtl' : undefined}
          className={cn(
            'w-full rounded-lg border px-3 py-2 text-sm text-gray-900',
            'placeholder:text-gray-400',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            error
              ? 'border-red-400 focus:ring-red-400'
              : 'border-gray-300 focus:border-emerald-500 focus:ring-emerald-400',
            'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400',
            className,
          )}
          {...props}
        />

        {hint && !error && (
          <p className="text-xs text-gray-400">{hint}</p>
        )}
        {error && (
          <p className="text-xs text-red-500" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
