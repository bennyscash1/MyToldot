'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { DayPicker, type Matcher } from 'react-day-picker';
import { useLocale, useTranslations } from 'next-intl';
import { he } from 'react-day-picker/locale';

import {
  dateToPickerDate,
  formatDigitsAsDdMmYyyy,
  formatGregorianDate,
  normalizePastedDate,
  parseGregorianDate,
  pickerDateToStoredDate,
} from '@/lib/dates/gregorian';
import { cn } from '@/lib/utils';
import { DATE_PICKER_POPOVER_ATTR } from '@/components/ui/datePickerPopover';

import 'react-day-picker/style.css';

const DISPLAY_COMPLETE = /^\d{2}\/\d{2}\/\d{4}$/;
const PICKER_ESTIMATED_HEIGHT = 340;

function computePopoverStyle(anchor: HTMLElement): CSSProperties {
  const rect = anchor.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const openAbove =
    spaceBelow < PICKER_ESTIMATED_HEIGHT &&
    rect.top > PICKER_ESTIMATED_HEIGHT;

  return {
    position: 'fixed',
    left: rect.left,
    top: openAbove ? rect.top - 4 : rect.bottom + 4,
    transform: openAbove ? 'translateY(-100%)' : undefined,
    zIndex: 70,
  };
}

export interface DateInputProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  id?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  min?: Date;
  max?: Date;
  className?: string;
  ariaLabel?: string;
  tabIndex?: number;
}

function CalendarIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function buildDisabledMatchers(min?: Date, max?: Date): Matcher[] | undefined {
  const matchers: Matcher[] = [];
  if (min) matchers.push({ before: dateToPickerDate(min) });
  if (max) matchers.push({ after: dateToPickerDate(max) });
  return matchers.length > 0 ? matchers : undefined;
}

export function DateInput({
  value,
  onChange,
  id: idProp,
  name,
  placeholder,
  disabled = false,
  required = false,
  min,
  max,
  className,
  ariaLabel,
  tabIndex,
}: DateInputProps) {
  const t = useTranslations('dateInput');
  const locale = useLocale();
  const generatedId = useId();
  const inputId = idProp ?? generatedId;
  const pickerDir = locale === 'he' ? 'rtl' : 'ltr';
  const dayPickerLocale = locale === 'he' ? he : undefined;

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const [display, setDisplay] = useState(() => formatGregorianDate(value));
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const [month, setMonth] = useState(() =>
    value ? dateToPickerDate(value) : new Date(),
  );

  const updatePopoverPosition = useCallback(() => {
    if (!containerRef.current) return;
    setPopoverStyle(computePopoverStyle(containerRef.current));
  }, []);

  const valueTime = value?.getTime() ?? null;
  useEffect(() => {
    setDisplay(formatGregorianDate(value));
    if (value) setMonth(dateToPickerDate(value));
  }, [valueTime, value]);

  const commitDisplay = useCallback(
    (nextDisplay: string) => {
      const trimmed = nextDisplay.trim();
      if (!trimmed) {
        setDisplay('');
        onChange(null);
        return;
      }
      const parsed = parseGregorianDate(trimmed);
      if (!parsed) {
        setDisplay('');
        onChange(null);
        return;
      }
      const normalized = formatGregorianDate(parsed);
      setDisplay(normalized);
      onChange(parsed);
    },
    [onChange],
  );

  const closePicker = useCallback(() => {
    setOpen(false);
    inputRef.current?.focus();
  }, []);

  const openPicker = useCallback(() => {
    if (disabled) return;
    setMonth(value ? dateToPickerDate(value) : new Date());
    setOpen(true);
  }, [disabled, value]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePopoverPosition();
    window.addEventListener('scroll', updatePopoverPosition, true);
    window.addEventListener('resize', updatePopoverPosition);
    return () => {
      window.removeEventListener('scroll', updatePopoverPosition, true);
      window.removeEventListener('resize', updatePopoverPosition);
    };
  }, [open, updatePopoverPosition]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current?.contains(target) ||
        pickerRef.current?.contains(target)
      ) {
        return;
      }
      closePicker();
    };
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closePicker();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, closePicker]);

  const handleInputChange = (raw: string) => {
    setDisplay(formatDigitsAsDdMmYyyy(raw));
  };

  const handleBlur = () => {
    const trimmed = display.trim();
    if (!trimmed) {
      setDisplay('');
      onChange(null);
      return;
    }
    if (!DISPLAY_COMPLETE.test(trimmed)) {
      setDisplay('');
      onChange(null);
      return;
    }
    commitDisplay(trimmed);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = normalizePastedDate(e.clipboardData.getData('text'));
    if (!pasted) {
      setDisplay('');
      onChange(null);
      return;
    }
    setDisplay(pasted);
    if (DISPLAY_COMPLETE.test(pasted)) {
      commitDisplay(pasted);
    }
  };

  const handleDaySelect = (selected: Date | undefined) => {
    if (!selected) return;
    const stored = pickerDateToStoredDate(selected);
    if (!stored) return;
    setDisplay(formatGregorianDate(stored));
    onChange(stored);
    closePicker();
  };

  const handleInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && open) {
      e.stopPropagation();
      closePicker();
    }
  };

  const handleCalendarKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPicker();
    }
    if (e.key === 'Escape' && open) {
      e.stopPropagation();
      closePicker();
    }
  };

  const selectedPickerDate = value ? dateToPickerDate(value) : undefined;
  const disabledMatchers = buildDisabledMatchers(min, max);

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        ref={inputRef}
        id={inputId}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        dir="ltr"
        disabled={disabled}
        required={required}
        tabIndex={tabIndex}
        placeholder={placeholder ?? t('placeholder')}
        aria-label={ariaLabel ?? placeholder ?? t('placeholder')}
        value={display}
        onChange={(e) => handleInputChange(e.target.value)}
        onBlur={handleBlur}
        onPaste={handlePaste}
        onKeyDown={handleInputKeyDown}
        className={cn(
          'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pe-9 text-sm text-gray-900',
          'placeholder:text-gray-400',
          'focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500',
          'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400',
          className,
        )}
      />
      <button
        type="button"
        disabled={disabled}
        tabIndex={tabIndex}
        onClick={() => (open ? closePicker() : openPicker())}
        onKeyDown={handleCalendarKeyDown}
        aria-label={t('openCalendar')}
        aria-expanded={open}
        aria-controls={open ? `${inputId}-calendar` : undefined}
        className={cn(
          'absolute inset-y-0 end-0 flex items-center px-2',
          'text-gray-400 transition-colors hover:text-emerald-600',
          'focus:outline-none focus-visible:text-emerald-600',
          'disabled:pointer-events-none disabled:opacity-50',
        )}
      >
        <CalendarIcon />
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={pickerRef}
            id={`${inputId}-calendar`}
            {...{ [DATE_PICKER_POPOVER_ATTR]: '' }}
            role="dialog"
            aria-modal={false}
            dir={pickerDir}
            style={popoverStyle}
            className={cn(
              'rounded-lg border border-gray-200 bg-white p-3 shadow-lg',
              'toldot-day-picker',
            )}
          >
            <DayPicker
              mode="single"
              locale={dayPickerLocale}
              dir={pickerDir}
              month={month}
              onMonthChange={setMonth}
              selected={selectedPickerDate}
              onSelect={handleDaySelect}
              disabled={disabledMatchers}
              classNames={{
                today: 'font-semibold underline decoration-emerald-600',
                selected:
                  'bg-emerald-600 text-white rounded-md hover:bg-emerald-600 hover:text-white',
                day: 'rounded-md hover:bg-[#f4f3e9]',
              }}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}