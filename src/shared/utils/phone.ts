const PHONE_REGEX = /^(?:\+[1-9][0-9]{0,3})?[0-9]{8,}$/;

export const normalizePhoneNumber = (value: string): string => value.replace(/\s/g, '').trim();

export const validatePhoneNumber = (value: string): string | null => {
  const normalizedPhone = normalizePhoneNumber(value);

  if (!normalizedPhone) return null;

  return PHONE_REGEX.test(normalizedPhone) ? null : 'Ugyldig telefonnummer format';
};

// Norwegian 8-digit numbers are shown as "400 00 001"; anything else is shown as stored.
export const formatPhoneDisplay = (value: string): string => {
  const normalized = normalizePhoneNumber(value);
  const match = /^(\+47)?(\d{3})(\d{2})(\d{3})$/.exec(normalized);
  if (!match) return value;
  return `${match[1] ? '+47 ' : ''}${match[2]} ${match[3]} ${match[4]}`;
};

export const toPhoneHref = (value: string): string => normalizePhoneNumber(value);
