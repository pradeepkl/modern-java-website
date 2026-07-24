import { paperbackWaitlistCopy } from '../data/paperbackWaitlistCopy';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface PaperbackWaitlistFormValues {
  name: string;
  email: string;
  city: string;
  paperbackConsent: boolean;
  promotionalConsent: boolean;
}

export type PaperbackWaitlistFieldErrors = Partial<
  Record<'name' | 'email' | 'paperbackConsent', string>
>;

export function normalizeWaitlistFormValues(
  values: PaperbackWaitlistFormValues,
): PaperbackWaitlistFormValues {
  return {
    name: values.name.trim(),
    email: values.email.trim().toLowerCase(),
    city: values.city.trim(),
    paperbackConsent: values.paperbackConsent === true,
    promotionalConsent: values.promotionalConsent === true,
  };
}

export function validateWaitlistForm(
  values: PaperbackWaitlistFormValues,
): PaperbackWaitlistFieldErrors {
  const normalized = normalizeWaitlistFormValues(values);
  const errors: PaperbackWaitlistFieldErrors = {};

  if (!normalized.name) {
    errors.name = paperbackWaitlistCopy.validation.name;
  }

  if (!normalized.email || !EMAIL_PATTERN.test(normalized.email)) {
    errors.email = paperbackWaitlistCopy.validation.email;
  }

  if (!normalized.paperbackConsent) {
    errors.paperbackConsent = paperbackWaitlistCopy.validation.consent;
  }

  return errors;
}

export function hasWaitlistFieldErrors(
  errors: PaperbackWaitlistFieldErrors,
): boolean {
  return Object.keys(errors).length > 0;
}
