import clsx from 'clsx';

export interface SpinnerProps {
  className?: string;
  /** SVG width/height in pixels. Default 40. */
  size?: number;
}

/**
 * Text-free circular spinner for loading states (RTL-safe — centered, no direction).
 */
export function Spinner({ className, size = 40 }: SpinnerProps) {
  return (
    <div
      role="status"
      className={clsx('inline-flex items-center justify-center', className)}
    >
      <svg
        className="animate-spin text-emerald-600"
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="20"
          cy="20"
          r="16"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-90"
          fill="currentColor"
          d="M36 20a16 16 0 0 0-16-16v4a12 12 0 0 1 12 12h4Z"
        />
      </svg>
      <span className="sr-only">Loading</span>
    </div>
  );
}
