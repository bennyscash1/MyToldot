'use client';

import { useTranslations } from 'next-intl';

import { normalizeGregorianDisplayInput } from '@/lib/dates/gregorian';
import { cn } from '@/lib/utils';

export interface DateInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'type' | 'value' | 'onChange'
  > {
  value: string;
  onChange: (value: string) => void;
}

export function DateInput({
  value,
  onChange,
  className,
  onBlur,
  ...props
}: DateInputProps) {
  const t = useTranslations('person');

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={t('datePlaceholder')}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => {
        onChange(normalizeGregorianDisplayInput(e.target.value));
        onBlur?.(e);
      }}
      className={cn(className)}
      {...props}
    />
  );
}
