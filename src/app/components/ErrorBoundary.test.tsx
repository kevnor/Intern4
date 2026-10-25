import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

const Broken = ({ message }: { message: string }) => {
  throw new Error(message);
};

describe('ErrorBoundary', () => {
  it('renders its children when nothing is wrong', () => {
    render(
      <ErrorBoundary>
        <p>Alt fungerer</p>
      </ErrorBoundary>
    );

    expect(screen.getByText('Alt fungerer')).toBeInTheDocument();
  });

  it('explains an ordinary crash and shows the message', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Broken message="Cannot read properties of undefined" />
      </ErrorBoundary>
    );

    expect(
      screen.getByRole('heading', { name: 'Noe gikk galt på denne siden' })
    ).toBeInTheDocument();
    expect(screen.getByText('Cannot read properties of undefined')).toBeInTheDocument();
  });

  it('says what is wrong when a page could not be loaded', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Broken message="Failed to fetch dynamically imported module: /src/x.tsx" />
      </ErrorBoundary>
    );

    expect(screen.getByRole('heading', { name: 'Siden kunne ikke lastes' })).toBeInTheDocument();
    expect(screen.getByText(/gammel versjon/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Last siden på nytt' })).toBeInTheDocument();
  });

  it('logs the crash', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Broken message="boom" />
      </ErrorBoundary>
    );

    expect(log.mock.calls.some((call) => String(call[0]).startsWith('Siden krasjet'))).toBe(true);
  });
});
