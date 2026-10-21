import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import RouteErrorBoundary from './RouteErrorBoundary';

const Broken = () => {
  throw new Error('Kunne ikke vise rommet');
};

const renderApp = () =>
  render(
    <MemoryRouter initialEntries={['/broken']}>
      <Link to="/fine">Til en annen side</Link>
      <RouteErrorBoundary>
        <Routes>
          <Route path="/broken" element={<Broken />} />
          <Route path="/fine" element={<p>Alt fungerer</p>} />
        </Routes>
      </RouteErrorBoundary>
    </MemoryRouter>
  );

describe('RouteErrorBoundary', () => {
  it('shows the error instead of a blank page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderApp();

    expect(screen.getByRole('alert')).toHaveTextContent('Noe gikk galt på denne siden');
    expect(screen.getByText('Kunne ikke vise rommet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Last siden på nytt' })).toBeInTheDocument();
  });

  it('lets the user move on to another page', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('link', { name: 'Til en annen side' }));

    expect(await screen.findByText('Alt fungerer')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
