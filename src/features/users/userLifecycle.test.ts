import { describe, expect, it } from 'vitest';
import {
  canSubmitNewUser,
  createEmptyNewUserInput,
  prepareNewUserInput,
  validateUserField,
} from './userLifecycle';

describe('userLifecycle', () => {
  it('validates room numbers in one place', () => {
    expect(validateUserField('roomNumber', 260)).toEqual({});
    expect(validateUserField('roomNumber', 99)).toEqual({
      roomNumber: 'Romnummer må være 060, 0, mellom 100-173, eller mellom 200-273',
    });
  });

  it('prepares the create-user payload with normalized phone and lookup defaults', () => {
    const user = createEmptyNewUserInput();
    const payload = prepareNewUserInput(
      { ...user, name: 'Test Beboer', email: 'test@example.test', phone: '400 00 001' },
      [{ id: 'school-annet', name: 'Annet' }],
      [{ id: 'study-annet', name: 'Annet' }]
    );

    expect(payload).toMatchObject({
      phone: '40000001',
      schoolId: 'school-annet',
      studyId: 'study-annet',
    });
  });

  it('requires loaded lookup options before submit', () => {
    const user = createEmptyNewUserInput('school-annet', 'study-annet');
    const readyUser = { ...user, name: 'Test Beboer', email: 'test@example.test' };

    expect(canSubmitNewUser(readyUser, { isSubmitting: false, lookupOptionsReady: false })).toBe(
      false
    );
    expect(canSubmitNewUser(readyUser, { isSubmitting: false, lookupOptionsReady: true })).toBe(
      true
    );
  });

  it('starts without a birth date and validates email addresses', () => {
    expect(createEmptyNewUserInput().birthDate).toBeUndefined();
    expect(validateUserField('email', 'ola@example.test')).toEqual({});
    expect(validateUserField('email', 'ola@example')).toEqual({ email: 'Ugyldig e-postadresse' });

    const user = { ...createEmptyNewUserInput(), name: 'Ola', email: 'ikke-en-epost' };
    expect(canSubmitNewUser(user, { isSubmitting: false, lookupOptionsReady: true })).toBe(false);
  });
});
