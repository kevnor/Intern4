import { getDefaultLookupId, LookupOption } from '../../shared/types/lookup';
import { NewUserInput } from '../../shared/types/user';
import { normalizePhoneNumber, validatePhoneNumber } from '../../shared/utils/phone';

export type UserValidationErrors = Record<string, string>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (value: string): boolean => EMAIL_REGEX.test(value.trim());

export const createEmptyNewUserInput = (schoolId = '', studyId = ''): NewUserInput => ({
  name: '',
  email: '',
  phone: '',
  // Unknown until entered; a default would count as age 0 in the resident statistics.
  birthDate: undefined,
  address: {
    street: '',
    postalCode: '',
    city: '',
  },
  schoolId,
  studyId,
  profilePicture: '',
  seniority: 0,
  roomNumber: 0,
  role: 'Halv/Halv',
  onLeave: false,
  isActive: true,
});

export const validateUserField = (name: string, value: unknown): UserValidationErrors => {
  const errors: UserValidationErrors = {};

  if (name === 'email' && value && !isValidEmail(String(value))) {
    errors.email = 'Ugyldig e-postadresse';
  }

  if (name === 'phone' && value) {
    const phoneError = validatePhoneNumber(String(value));
    if (phoneError) errors.phone = phoneError;
  }

  if (name === 'seniority' && value !== undefined) {
    const seniorityNum = typeof value === 'number' ? value : parseInt(String(value));
    if (isNaN(seniorityNum) || seniorityNum < 0) {
      errors.seniority = 'Ansiennitet må være et positivt tall';
    }
  }

  if (name === 'roomNumber' && value) {
    const roomNum = typeof value === 'number' ? value : parseInt(String(value));
    if (isNaN(roomNum)) {
      errors.roomNumber = 'Romnummer må være et tall';
    } else if (
      roomNum !== 60 &&
      roomNum !== 0 &&
      !(roomNum >= 100 && roomNum <= 173) &&
      !(roomNum >= 200 && roomNum <= 273)
    ) {
      errors.roomNumber = 'Romnummer må være 060, 0, mellom 100-173, eller mellom 200-273';
    }
  }

  return errors;
};

export const validateNewUserInput = (userData: NewUserInput): UserValidationErrors => {
  return Object.entries(userData).reduce((errors, [key, value]) => {
    return {
      ...errors,
      ...validateUserField(key, value),
    };
  }, {} as UserValidationErrors);
};

export const canSubmitNewUser = (
  userData: NewUserInput,
  options: { isSubmitting: boolean; lookupOptionsReady: boolean }
): boolean => {
  return (
    !options.isSubmitting &&
    options.lookupOptionsReady &&
    Boolean(userData.name.trim()) &&
    isValidEmail(userData.email)
  );
};

export const prepareNewUserInput = (
  userData: NewUserInput,
  schools: LookupOption[],
  studies: LookupOption[]
): NewUserInput => ({
  ...userData,
  phone: normalizePhoneNumber(userData.phone ?? ''),
  schoolId: userData.schoolId || getDefaultLookupId(schools),
  studyId: userData.studyId || getDefaultLookupId(studies),
});
