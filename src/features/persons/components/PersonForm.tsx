'use client';

import { useState, type FormEvent } from 'react';
import clsx from 'clsx';

import { gregorianToHebrewText } from '../lib/hebrewDate';
import type { PersonInput } from '@/features/family-tree/schemas/person.schema';

// Hebrew-first UI strings. These should migrate to next-intl keys later, but
// for MVP we hardcode so the form is readable for review.
const L = {
  firstName: 'שם פרטי',
  lastName: 'שם משפחה',
  maidenName: 'שם נעורים',
  firstNameHe: 'שם פרטי (עברית)',
  lastNameHe: 'שם משפחה (עברית)',
  gender: 'מין',
  male: 'זכר',
  female: 'נקבה',
  birthDate: 'תאריך לידה',
  deathDate: 'תאריך פטירה',
  birthPlace: 'מקום לידה',
  bio: 'ביוגרפיה',
  hebrewDatePrefix: 'תאריך עברי:',
  requiredFirstName: 'שם פרטי הוא שדה חובה',
  requiredGender: 'יש לבחור מין',
} as const;

export interface PersonFormProps {
  /** 'quick' = name + gender + birth_date only (AddRelativePopover).
   *  'full'  = every field (PersonSidePanel edit mode). */
  variant: 'quick' | 'full';
  initialValue?: Partial<PersonInput>;
  /** Override default first-name gender — useful for "add father" vs "add mother". */
  defaultGender?: 'MALE' | 'FEMALE';
  /** Locks gender to a fixed value (used by spouse auto-assignment). */
  forcedGender?: 'MALE' | 'FEMALE';
  submitLabel: string;
  cancelLabel?: string;
  onSubmit: (value: PersonInput) => Promise<void> | void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  /** Shown above the form submit button when the server rejects the call. */
  errorMessage?: string | null;
}

export function PersonForm({
  variant,
  initialValue,
  defaultGender,
  forcedGender,
  submitLabel,
  cancelLabel,
  onSubmit,
  onCancel,
  isSubmitting = false,
  errorMessage,
}: PersonFormProps) {
  const [firstName, setFirstName] = useState(initialValue?.first_name ?? '');
  const [lastName, setLastName] = useState(initialValue?.last_name ?? '');
  const [firstNameHe, setFirstNameHe] = useState(initialValue?.first_name_he ?? '');
  const [lastNameHe, setLastNameHe] = useState(initialValue?.last_name_he ?? '');
  const [maidenName, setMaidenName] = useState(initialValue?.maiden_name ?? '');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | null>(
    forcedGender ?? (initialValue?.gender as 'MALE' | 'FEMALE' | undefined) ?? defaultGender ?? null,
  );
  const [birthDate, setBirthDate] = useState(toDateInputValue(initialValue?.birth_date));
  const [deathDate, setDeathDate] = useState(toDateInputValue(initialValue?.death_date));
  const [birthPlace, setBirthPlace] = useState(initialValue?.birth_place ?? '');
  const [bio, setBio] = useState(initialValue?.bio ?? '');

  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      setLocalError(L.requiredFirstName);
      return;
    }
    if (!forcedGender && !gender) {
      setLocalError(L.requiredGender);
      return;
    }
    setLocalError(null);

    const effectiveGender = forcedGender ?? gender;
    if (!effectiveGender) return;

    const value: PersonInput = {
      first_name: firstName.trim(),
      last_name: lastName.trim() || null,
      first_name_he: firstNameHe.trim() || null,
      last_name_he: lastNameHe.trim() || null,
      maiden_name: maidenName.trim() || null,
      gender: effectiveGender,
      birth_date: birthDate ? new Date(birthDate) : null,
      death_date: deathDate ? new Date(deathDate) : null,
      birth_place: birthPlace.trim() || null,
      bio: bio.trim() || null,
      profile_image: initialValue?.profile_image ?? null,
    };
    await onSubmit(value);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" dir="rtl">
      {/* Name fields */}
      <div className="grid grid-cols-2 gap-2">
        <FieldLabel label={L.firstName} required>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={inputClass}
            autoFocus
          />
        </FieldLabel>
        <FieldLabel label={L.lastName}>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={inputClass}
          />
        </FieldLabel>
      </div>

      {variant === 'full' && (
        <div className="grid grid-cols-2 gap-2">
          <FieldLabel label={L.firstNameHe}>
            <input
              type="text"
              value={firstNameHe}
              onChange={(e) => setFirstNameHe(e.target.value)}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label={L.lastNameHe}>
            <input
              type="text"
              value={lastNameHe}
              onChange={(e) => setLastNameHe(e.target.value)}
              className={inputClass}
            />
          </FieldLabel>
        </div>
      )}

      {variant === 'full' && gender === 'FEMALE' && (
        <FieldLabel label={L.maidenName}>
          <input
            type="text"
            value={maidenName}
            onChange={(e) => setMaidenName(e.target.value)}
            className={inputClass}
          />
        </FieldLabel>
      )}

      {/* Gender — restricted to Male/Female per audience requirements */}
      <FieldLabel label={L.gender} required>
        <div className="flex gap-2">
          <GenderButton
            active={(forcedGender ?? gender) === 'MALE'}
            onClick={() => {
              if (forcedGender) return;
              setGender('MALE');
            }}
            disabled={Boolean(forcedGender)}
          >
            {L.male}
          </GenderButton>
          <GenderButton
            active={(forcedGender ?? gender) === 'FEMALE'}
            onClick={() => {
              if (forcedGender) return;
              setGender('FEMALE');
            }}
            disabled={Boolean(forcedGender)}
          >
            {L.female}
          </GenderButton>
        </div>
      </FieldLabel>

      {/* Dates with live Hebrew-date preview */}
      <DateFieldWithHebrew label={L.birthDate} value={birthDate} onChange={setBirthDate} />
      {variant === 'full' && (
        <DateFieldWithHebrew label={L.deathDate} value={deathDate} onChange={setDeathDate} />
      )}

      {variant === 'full' && (
        <>
          <FieldLabel label={L.birthPlace}>
            <input
              type="text"
              value={birthPlace}
              onChange={(e) => setBirthPlace(e.target.value)}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label={L.bio}>
            <textarea
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className={clsx(inputClass, 'resize-none')}
            />
          </FieldLabel>
        </>
      )}

      {(localError || errorMessage) && (
        <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {localError ?? errorMessage}
        </div>
      )}

      <div className="mt-2 flex items-center justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {cancelLabel ?? 'ביטול'}
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {isSubmitting ? '…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

// ── Sub-components ────────────────────────────────────────────

const inputClass =
  'w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500';

function FieldLabel({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-600">
        {label}
        {required && <span className="mr-0.5 text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function GenderButton({
  active,
  onClick,
  disabled = false,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'flex-1 rounded-md border px-3 py-1.5 text-sm transition disabled:cursor-not-allowed',
        active
          ? 'border-sky-500 bg-sky-50 text-sky-700'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:hover:bg-white',
      )}
    >
      {children}
    </button>
  );
}

function DateFieldWithHebrew({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const hebrew = gregorianToHebrewText(value || null);
  return (
    <FieldLabel label={label}>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      {hebrew && (
        <span dir="rtl" className="mt-0.5 text-[11px] text-slate-500">
          תאריך עברי:&nbsp;
          <span className="font-medium text-slate-700">{hebrew}</span>
        </span>
      )}
    </FieldLabel>
  );
}

function toDateInputValue(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  // YYYY-MM-DD for <input type="date">
  return date.toISOString().slice(0, 10);
}
