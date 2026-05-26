import { cn } from '@/lib/utils';

interface BrandMarkProps {
  className?: string;
  monochrome?: boolean;
}

export function BrandMark({ className, monochrome = false }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('size-10 text-brand-green', className)}
      aria-hidden="true"
    >
      <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="3" />
      <rect x="30" y="38" width="4" height="14" fill="currentColor" rx="1" />
      <ellipse cx="22" cy="28" rx="6" ry="8" fill="currentColor" transform="rotate(-20 22 28)" />
      <ellipse cx="42" cy="28" rx="6" ry="8" fill="currentColor" transform="rotate(20 42 28)" />
      <ellipse cx="32" cy="22" rx="6" ry="9" fill="currentColor" />
      <ellipse cx="28" cy="34" rx="5" ry="6" fill="currentColor" />
      <ellipse cx="36" cy="34" rx="5" ry="6" fill="currentColor" />
      <circle cx="32" cy="28" r="2" fill={monochrome ? 'currentColor' : '#4d7549'} />
    </svg>
  );
}
