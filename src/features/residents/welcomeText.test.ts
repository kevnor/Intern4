import { describe, expect, it } from 'vitest';
import { buildWelcomeText } from './welcomeText';

const resident = {
  name: 'Kari Nordmann',
  email: 'kari@example.no',
  loginUrl: 'https://intern.example.no/login',
};

describe('buildWelcomeText', () => {
  it('points to Microsoft sign-in and has no password', () => {
    const text = buildWelcomeText(resident);

    expect(text).toContain('Hei Kari!');
    expect(text).toContain('Logg inn her: https://intern.example.no/login');
    expect(text).toContain('«Logg inn med Microsoft»');
    expect(text).toContain('kari@example.no');
    expect(text).not.toMatch(/passord/i);
  });

  it('adds the temporary password while email and password is on', () => {
    const text = buildWelcomeText({ ...resident, initialPassword: 'Abc123xyz789' });

    expect(text).toContain('midlertidige passordet: Abc123xyz789');
    expect(text).toContain('Bytt passordet etter første innlogging.');
  });
});
