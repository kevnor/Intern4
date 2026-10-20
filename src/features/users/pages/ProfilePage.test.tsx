import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProfilePage from './ProfilePage';
import { ThemeProvider } from '../../../app/providers/ThemeProvider';

const mockUseAuth = vi.fn();
const mockGetUser = vi.fn();
const mockUpdateUser = vi.fn();
const mockGetSchools = vi.fn();
const mockGetStudies = vi.fn();
const mockResetPassword = vi.fn();
const mockRefreshSession = vi.fn();
const mockUploadImages = vi.fn();
const mockDeleteImages = vi.fn();
const mockCreateSignedImageUrl = vi.fn();

vi.mock('../../../app/providers/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../../server/dao/userDAO', () => ({
  getSchools: (...args: unknown[]) => mockGetSchools(...args),
  getStudies: (...args: unknown[]) => mockGetStudies(...args),
  getUser: (...args: unknown[]) => mockGetUser(...args),
  updateUser: (...args: unknown[]) => mockUpdateUser(...args),
}));

const schools = [
  { id: 'school-annet', name: 'Annet' },
  { id: 'school-ntnu', name: 'NTNU' },
];

const studies = [
  { id: 'study-annet', name: 'Annet' },
  { id: 'study-data', name: 'Datateknologi' },
];

vi.mock('../../../server/dao/authentication', () => ({
  resetPassword: (...args: unknown[]) => mockResetPassword(...args),
}));

vi.mock('../../../server/supabaseClient', () => ({
  supabase: {
    auth: {
      refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
    },
  },
}));

vi.mock('../../../server/storage', () => ({
  uploadImages: (...args: unknown[]) => mockUploadImages(...args),
  deleteImages: (...args: unknown[]) => mockDeleteImages(...args),
  deleteImagesBestEffort: (...args: unknown[]) => mockDeleteImages(...args),
  createSignedImageUrl: (...args: unknown[]) => mockCreateSignedImageUrl(...args),
}));

const profile = {
  name: 'Johannes Aamot-Skeidsvoll',
  email: 'johannes@singsaker.no',
  phone: '41177262',
  birthDate: new Date('2005-12-03T00:00:00.000Z'),
  address: {
    street: 'Gimleveien 95',
    postalCode: '7052',
    city: 'Trondheim',
    country: 'Norge',
  },
  schoolId: 'school-ntnu',
  studyId: 'study-data',
  study: 'Datateknologi',
  studyPlace: 'NTNU',
  profilePicture: '',
  seniority: 2,
  roomNumber: 150,
  role: 'Halv/Halv',
  onLeave: false,
  isActive: true,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
};

const renderProfile = () =>
  render(
    <ThemeProvider>
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    </ThemeProvider>
  );

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    mockUseAuth.mockReturnValue({
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Johannes Aamot-Skeidsvoll',
        email: 'johannes@singsaker.no',
        role: 'Data',
      },
      loading: false,
    });
    mockGetUser.mockResolvedValue(profile);
    mockGetSchools.mockResolvedValue(schools);
    mockGetStudies.mockResolvedValue(studies);
    mockUpdateUser.mockResolvedValue(undefined);
    mockResetPassword.mockResolvedValue({ success: true });
    mockRefreshSession.mockResolvedValue(undefined);
    mockUploadImages.mockResolvedValue(['11111111-1111-4111-8111-111111111111/profile/avatar.png']);
    mockDeleteImages.mockResolvedValue(undefined);
    mockCreateSignedImageUrl.mockResolvedValue('https://example.com/avatar.png');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the current profile into split-name fields and keeps email read-only', async () => {
    renderProfile();

    expect(await screen.findByDisplayValue('Johannes')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Aamot-Skeidsvoll')).toBeInTheDocument();
    expect(screen.getByDisplayValue('johannes@singsaker.no')).toBeDisabled();
    expect(screen.getByDisplayValue('41177262')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Skole / studiested' })).toHaveValue('school-ntnu');
    expect(screen.getByRole('combobox', { name: 'Studie' })).toHaveValue('study-data');
  });

  it('saves editable profile information with the merged name and current field values', async () => {
    const user = userEvent.setup();

    renderProfile();

    const firstName = await screen.findByLabelText('Fornavn');
    await user.clear(firstName);
    await user.type(firstName, 'Johannes');

    const middleName = screen.getByLabelText('Mellomnavn');
    await user.type(middleName, ' Aamot');

    const lastName = screen.getByLabelText('Etternavn');
    await user.clear(lastName);
    await user.type(lastName, 'Skeidsvoll');

    const phone = screen.getByLabelText('Telefon');
    await user.clear(phone);
    await user.type(phone, '42223344');

    const city = screen.getByLabelText('By');
    await user.clear(city);
    await user.type(city, 'Oslo');

    await user.click(screen.getByRole('button', { name: 'Lagre endringer' }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', {
        name: 'Johannes Aamot Skeidsvoll',
        phone: '42223344',
        birthDate: new Date('2005-12-03'),
        address: {
          street: 'Gimleveien 95',
          postalCode: '7052',
          city: 'Oslo',
        },
        schoolId: 'school-ntnu',
        studyId: 'study-data',
      });
    });

    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Profilen din ble oppdatert.')).toBeInTheDocument();
  });

  it('validates and updates the password through the auth DAO', async () => {
    const user = userEvent.setup();

    renderProfile();

    await screen.findByLabelText('Fornavn');
    await user.click(screen.getByRole('tab', { name: 'Passord' }));

    await user.type(screen.getByLabelText(/^nytt passord/i), '123');
    await user.type(screen.getByLabelText(/^gjenta passord/i), '1234');
    await user.click(screen.getByRole('button', { name: 'Oppdater passord' }));

    expect(await screen.findByText('Passordet må være minst 6 tegn.')).toBeInTheDocument();
    expect(mockResetPassword).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText(/^nytt passord/i));
    await user.clear(screen.getByLabelText(/^gjenta passord/i));
    await user.type(screen.getByLabelText(/^nytt passord/i), 'sterktpassord');
    await user.type(screen.getByLabelText(/^gjenta passord/i), 'sterktpassord');
    await user.click(screen.getByRole('button', { name: 'Oppdater passord' }));

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith('sterktpassord');
    });
    expect(await screen.findByText('Passordet ditt ble oppdatert.')).toBeInTheDocument();
  });

  it('uploads and saves a new profile picture', async () => {
    const user = userEvent.setup();

    renderProfile();

    await screen.findByLabelText('Fornavn');

    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Last opp bilde'), file);

    await waitFor(() => {
      expect(mockUploadImages).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
        'profile',
        [file]
      );
    });

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', {
        profilePicture: '11111111-1111-4111-8111-111111111111/profile/avatar.png',
      });
    });
    expect(await screen.findByText('Profilbildet ble oppdatert.')).toBeInTheDocument();
    expect(await screen.findByAltText('Profilbilde')).toHaveAttribute(
      'src',
      'https://example.com/avatar.png'
    );
  });

  it('does not delete the new profile image if post-save refresh fails', async () => {
    const user = userEvent.setup();
    mockCreateSignedImageUrl.mockRejectedValueOnce(new Error('signed url failed'));

    renderProfile();

    await screen.findByLabelText('Fornavn');

    await user.upload(
      screen.getByLabelText('Last opp bilde'),
      new File(['avatar'], 'avatar.png', { type: 'image/png' })
    );

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', {
        profilePicture: '11111111-1111-4111-8111-111111111111/profile/avatar.png',
      });
    });

    expect(await screen.findByText('signed url failed')).toBeInTheDocument();
    expect(mockDeleteImages).not.toHaveBeenCalled();
  });

  it('hides unfinished sections and offers the theme choice', async () => {
    const user = userEvent.setup();
    renderProfile();

    await screen.findByLabelText('Fornavn');

    expect(screen.queryByText('Kommer senere')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'E-postlister' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Last opp bilde')).toBeEnabled();

    await user.click(screen.getByRole('tab', { name: 'Utseende' }));
    await user.click(screen.getByRole('radio', { name: 'Mørk' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('keeps unsaved edits when the auth session refreshes', async () => {
    const user = userEvent.setup();
    const { rerender } = renderProfile();

    const city = await screen.findByLabelText('By');
    await user.clear(city);
    await user.type(city, 'Bergen');

    // A token refresh hands out a new user object for the same person.
    mockUseAuth.mockReturnValue({
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Johannes Aamot-Skeidsvoll',
        email: 'johannes@singsaker.no',
        role: 'Data',
      },
      loading: false,
    });
    rerender(
      <ThemeProvider>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </ThemeProvider>
    );

    expect(screen.getByLabelText('By')).toHaveValue('Bergen');
    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });
});
