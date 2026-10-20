import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResidentDirectoryPage from './ResidentDirectoryPage';
import { createUser, getResidentDirectoryUsers, reactivateUser } from '../../../server/dao/userDAO';

const mockUseAuth = vi.fn();

vi.mock('../../../app/providers/AuthContext', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('../../../server/dao/userDAO', () => ({
  getResidentDirectoryUsers: vi.fn(),
  reactivateUser: vi.fn(),
  createUser: vi.fn(),
  getRoles: vi.fn().mockResolvedValue([{ id: '7', name: 'Halv/Halv' }]),
  getSchools: vi.fn().mockResolvedValue([{ id: 'school-annet', name: 'Annet' }]),
  getStudies: vi.fn().mockResolvedValue([{ id: 'study-annet', name: 'Annet' }]),
}));
vi.mock('../../../server/storage', () => ({
  createSignedImageUrls: vi.fn().mockResolvedValue(['https://example.test/one.png']),
}));

const profileLinkNames = (container: HTMLElement) =>
  within(container)
    .getAllByRole('link')
    .filter((link) => link.getAttribute('href')?.startsWith('/beboere/'))
    .map((link) => link.textContent);

const asRole = (role: string) =>
  mockUseAuth.mockReturnValue({ user: { id: 'viewer', name: 'Viewer', role } });

const activeResidents = [
  {
    id: '1',
    name: 'Test Beboer En',
    email: 'test.beboer.en@example.test',
    phone: '40000001',
    birthDate: '2000-01-01',
    study: 'Bioteknologi',
    studyPlace: 'NTNU',
    seniority: 4,
    roomNumber: 101,
    createdAt: '2024-08-15T00:00:00.000Z',
    role: 'Halv/Halv',
    onLeave: false,
    isActive: true,
    address: { street: 'Testgata 1', postalCode: '7000', city: 'Testby' },
  },
  {
    id: '2',
    name: 'Demo Beboer To',
    email: 'demo.beboer.to@example.test',
    phone: '40000002',
    birthDate: null,
    study: 'Fysikk og matematikk',
    studyPlace: 'NTNU',
    seniority: 1,
    roomNumber: 202,
    createdAt: '2026-01-20T00:00:00.000Z',
    role: 'Full Vakt',
    onLeave: false,
    isActive: true,
    address: { street: '', postalCode: '', city: '' },
  },
];

const oldResidents = [
  {
    id: '3',
    name: 'Tidligere Testperson',
    email: '',
    phone: '',
    birthDate: null,
    study: '',
    studyPlace: '',
    seniority: 0,
    roomNumber: null,
    createdAt: '2020-01-01T00:00:00.000Z',
    role: undefined,
    onLeave: false,
    isActive: false,
    address: { street: 'Arkivveien 12', postalCode: '7999', city: '' },
  },
];

const renderPage = (path = '/beboere') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ResidentDirectoryPage />
    </MemoryRouter>
  );

describe('ResidentDirectoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asRole('Halv/Halv');
  });

  it('renders the active resident list with example columns', async () => {
    vi.mocked(getResidentDirectoryUsers).mockResolvedValue(activeResidents);

    renderPage('/beboere');

    expect(await screen.findByRole('heading', { name: 'Beboerliste' })).toBeInTheDocument();
    expect(getResidentDirectoryUsers).toHaveBeenCalledWith(true);
    expect(screen.getByRole('columnheader', { name: 'Navn' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Rom' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Telefon' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'E-post' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Studie' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Født' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Rolle' })).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Test Beboer En')).toBeInTheDocument();
    expect(within(table).getByText('101')).toBeInTheDocument();
    expect(within(table).getByRole('link', { name: '400 00 001' })).toHaveAttribute(
      'href',
      'tel:40000001'
    );
    expect(within(table).getByText('4. Bioteknologi (NTNU)')).toBeInTheDocument();
  });

  it('filters current residents by search query', async () => {
    const user = userEvent.setup();
    vi.mocked(getResidentDirectoryUsers).mockResolvedValue(activeResidents);

    renderPage('/beboere');

    await screen.findAllByText('Test Beboer En');
    await user.type(screen.getByPlaceholderText(/søk etter navn/i), 'Fysikk');

    expect(screen.queryByText('Test Beboer En')).not.toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Demo Beboer To')).toBeInTheDocument();
  });

  it('renders old residents from former residents', async () => {
    vi.mocked(getResidentDirectoryUsers).mockResolvedValue(oldResidents);

    renderPage('/beboere/gamle');

    expect(await screen.findByRole('heading', { name: 'Gamle beboere' })).toBeInTheDocument();
    expect(getResidentDirectoryUsers).toHaveBeenCalledWith(false);
    expect(await screen.findByRole('columnheader', { name: 'Adresse' })).toBeInTheDocument();
    expect(await screen.findByRole('columnheader', { name: 'Postnummer' })).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Tidligere Testperson')).toBeInTheDocument();
    expect(within(table).getByText('Arkivveien 12')).toBeInTheDocument();
    expect(within(table).getByText('7999')).toBeInTheDocument();
  });

  it('renders statistics for current residents', async () => {
    vi.mocked(getResidentDirectoryUsers).mockResolvedValue(activeResidents);

    renderPage('/beboere/statistikk');

    expect(await screen.findByRole('heading', { name: 'Statistikk' })).toBeInTheDocument();
    expect(getResidentDirectoryUsers).toHaveBeenCalledWith(true);
    const activeResidentsCard =
      // The charts load lazily; the first import is slow under a full test run.
      (
        await screen.findByRole('heading', { name: 'Nåværende beboere' }, { timeout: 5000 })
      ).closest('section');
    const averageAgeCard = screen.getByRole('heading', { name: 'Snittalder' }).closest('section');
    const averageStudyYearCard = screen
      .getByRole('heading', { name: 'Snitt studieår' })
      .closest('section');
    const averageSemestersCard = screen
      .getByRole('heading', { name: 'Snitt botid' })
      .closest('section');
    const mostCommonStudyCard = screen
      .getByRole('heading', { name: 'Vanligste studie' })
      .closest('section');

    expect(activeResidentsCard).not.toBeNull();
    expect(averageAgeCard).not.toBeNull();
    expect(averageStudyYearCard).not.toBeNull();
    expect(averageSemestersCard).not.toBeNull();
    expect(mostCommonStudyCard).not.toBeNull();
    expect(within(activeResidentsCard!).getByText('2')).toBeInTheDocument();
    expect(within(averageAgeCard!).getByText(/år$/)).toBeInTheDocument();
    expect(within(averageStudyYearCard!).getByText('2.5')).toBeInTheDocument();
    expect(within(averageSemestersCard!).getByText(/semestre$/)).toBeInTheDocument();
    expect(within(mostCommonStudyCard!).getByText('Bioteknologi')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Aldersfordeling' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Studieår' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Botid' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Studieprogram' })).toBeInTheDocument();
    expect(screen.getByLabelText('26+: 1 (50 %)')).toBeInTheDocument();
    expect(screen.getAllByLabelText('1: 1 (50 %)').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('4: 1 (50 %)')).toBeInTheDocument();
    expect(screen.getByLabelText('Bioteknologi: 1 (50 %)')).toBeInTheDocument();
    expect(screen.getByLabelText('Fysikk og matematikk: 1 (50 %)')).toBeInTheDocument();
  });

  it('shows loading, error, and empty states', async () => {
    vi.mocked(getResidentDirectoryUsers).mockImplementationOnce(() => new Promise(() => undefined));

    const { unmount } = renderPage('/beboere');

    expect(screen.getByLabelText('Laster beboere')).toBeInTheDocument();
    unmount();

    vi.mocked(getResidentDirectoryUsers).mockRejectedValueOnce(new Error('Nope'));
    renderPage('/beboere');

    expect(await screen.findByText('Kunne ikke laste beboere.')).toBeInTheDocument();

    vi.mocked(getResidentDirectoryUsers).mockResolvedValueOnce([]);
    renderPage('/beboere/gamle');

    await waitFor(() => {
      expect(screen.getByText('Ingen gamle beboere funnet.')).toBeInTheDocument();
    });
  });

  it('gives each resident call, SMS and e-mail shortcuts', async () => {
    vi.mocked(getResidentDirectoryUsers).mockResolvedValue(activeResidents);

    renderPage('/beboere');

    expect(await screen.findByRole('link', { name: 'Ring Test Beboer En' })).toHaveAttribute(
      'href',
      'tel:40000001'
    );
    expect(screen.getByRole('link', { name: 'Send SMS til Test Beboer En' })).toHaveAttribute(
      'href',
      'sms:40000001'
    );
    expect(screen.getByRole('link', { name: 'Send e-post til Test Beboer En' })).toHaveAttribute(
      'href',
      'mailto:test.beboer.en@example.test'
    );
  });

  it('switches between tabs and loads the matching residents', async () => {
    const user = userEvent.setup();
    vi.mocked(getResidentDirectoryUsers).mockImplementation(async (active) =>
      active ? activeResidents : oldResidents
    );

    renderPage('/beboere');
    await screen.findByRole('heading', { name: 'Beboerliste' });

    await user.click(screen.getByRole('tab', { name: 'Gamle beboere' }));

    expect(await screen.findByRole('heading', { name: 'Gamle beboere' })).toBeInTheDocument();
    expect(getResidentDirectoryUsers).toHaveBeenLastCalledWith(false);
    expect(
      await within(await screen.findByRole('table')).findByText('Tidligere Testperson')
    ).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Beboerkart' })).not.toBeInTheDocument();
  });

  it('ignores a slow response from the previous tab', async () => {
    const user = userEvent.setup();
    let resolveActive: (value: typeof activeResidents) => void = () => undefined;
    vi.mocked(getResidentDirectoryUsers).mockImplementation((active) =>
      active
        ? new Promise((resolve) => {
            resolveActive = resolve;
          })
        : Promise.resolve(oldResidents)
    );

    renderPage('/beboere');
    await user.click(screen.getByRole('tab', { name: 'Gamle beboere' }));
    await within(await screen.findByRole('table')).findByText('Tidligere Testperson');

    resolveActive(activeResidents);

    await waitFor(() =>
      expect(
        within(screen.getByRole('table')).getByText('Tidligere Testperson')
      ).toBeInTheDocument()
    );
    expect(screen.queryByText('Test Beboer En')).not.toBeInTheDocument();
  });

  it('links each resident to their profile', async () => {
    vi.mocked(getResidentDirectoryUsers).mockResolvedValue(activeResidents);
    renderPage('/beboere');

    const table = await screen.findByRole('table');
    expect(within(table).getByRole('link', { name: 'Test Beboer En' })).toHaveAttribute(
      'href',
      '/beboere/1'
    );
  });

  it('sorts by seniority, highest first', async () => {
    const user = userEvent.setup();
    vi.mocked(getResidentDirectoryUsers).mockResolvedValue(activeResidents);
    renderPage('/beboere');

    const table = await screen.findByRole('table');
    await user.selectOptions(screen.getByLabelText('Sortering'), 'seniority');

    expect(profileLinkNames(table)).toEqual(['Test Beboer En', 'Demo Beboer To']);
  });

  it('keeps admin tools away from regular residents', async () => {
    vi.mocked(getResidentDirectoryUsers).mockResolvedValue(activeResidents);
    renderPage('/beboere');

    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: 'Ny beboer' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Filtrer på rolle')).not.toBeInTheDocument();
  });

  it('lets room managers filter by role and leave, and create residents', async () => {
    const user = userEvent.setup();
    asRole('Romsjef');
    vi.mocked(getResidentDirectoryUsers).mockResolvedValue([
      ...activeResidents,
      { ...activeResidents[0], id: '9', name: 'Per Permisjon', onLeave: true },
    ]);
    vi.mocked(createUser).mockResolvedValue({ id: 'new', initialPassword: 'abc123' });
    renderPage('/beboere');

    const table = await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Permisjon' }));
    expect(profileLinkNames(table)).toEqual(['Per Permisjon']);
    expect(within(table).getByText('Per Permisjon')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Permisjon' }));

    await user.selectOptions(screen.getByLabelText('Filtrer på rolle'), 'Full Vakt');
    expect(within(table).getByText('Demo Beboer To')).toBeInTheDocument();
    expect(within(table).queryByText('Test Beboer En')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ny beboer' }));
    const form = screen.getByRole('dialog', { name: 'Ny bruker' });
    await user.type(within(form).getByLabelText(/^navn/i), 'Ny Beboer');
    await user.type(within(form).getByLabelText(/^e-post/i), 'ny@example.test');
    await user.click(screen.getByRole('button', { name: 'Legg til bruker' }));

    await waitFor(() =>
      expect(createUser).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Ny Beboer', email: 'ny@example.test' })
      )
    );
    expect(
      within(await screen.findByRole('dialog', { name: 'Bruker opprettet' })).getByLabelText(
        'Midlertidig passord'
      )
    ).toHaveTextContent('abc123');
    expect(getResidentDirectoryUsers).toHaveBeenCalledTimes(2);
  });

  it('lets room managers reactivate former residents', async () => {
    const user = userEvent.setup();
    asRole('Romsjef');
    vi.mocked(getResidentDirectoryUsers).mockResolvedValue(oldResidents);
    vi.mocked(reactivateUser).mockResolvedValue(undefined);
    renderPage('/beboere/gamle');

    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('button', { name: 'Reaktiver Tidligere Testperson' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Reaktivere beboer?' })).getByRole('button', {
        name: 'Reaktiver',
      })
    );

    await waitFor(() => expect(reactivateUser).toHaveBeenCalledWith('3'));
    expect(await screen.findByText('Tidligere Testperson er aktiv igjen.')).toBeInTheDocument();
  });
});
