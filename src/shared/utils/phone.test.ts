import { describe, expect, it } from 'vitest';
import { formatPhoneDisplay, toPhoneHref } from './phone';

describe('phone', () => {
  it('groups Norwegian numbers for display', () => {
    expect(formatPhoneDisplay('40000001')).toBe('400 00 001');
    expect(formatPhoneDisplay('+47 40000001')).toBe('+47 400 00 001');
    expect(formatPhoneDisplay('+4612345678901')).toBe('+4612345678901');
  });

  it('strips spaces for tel: and sms: links', () => {
    expect(toPhoneHref('+47 400 00 001')).toBe('+4740000001');
  });
});
