const CONTROL_CHARS_EXCEPT_NEWLINES = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const INTEGER_CHARS = /[^\d]/g;

export const inputLimits = {
  shortText: 120,
  mediumText: 240,
  longText: 1200,
  number: 6,
  search: 100,
  id: 80
} as const;

export function sanitizePlainText(value: string, maxLength: number = inputLimits.mediumText) {
  return value.replace(CONTROL_CHARS_EXCEPT_NEWLINES, "").slice(0, maxLength);
}

export function sanitizeSingleLine(value: string, maxLength: number = inputLimits.shortText) {
  return sanitizePlainText(value, maxLength).replace(/\s+/g, " ");
}

export function sanitizeIntegerInput(value: string, maxLength: number = inputLimits.number) {
  return value.replace(INTEGER_CHARS, "").slice(0, maxLength);
}

export function isSafeId(value: string | null | undefined) {
  return Boolean(value && /^[a-zA-Z0-9_-]{1,80}$/.test(value));
}
