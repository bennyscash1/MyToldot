/** Attribute on the portaled DayPicker root (see DateInput). */
export const DATE_PICKER_POPOVER_ATTR = 'data-date-picker-popover';

const DATE_PICKER_POPOVER_SELECTOR = `[${DATE_PICKER_POPOVER_ATTR}]`;

/** True when the event target is inside a portaled date picker calendar. */
export function isInsideDatePickerPopover(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(DATE_PICKER_POPOVER_SELECTOR) !== null
  );
}
