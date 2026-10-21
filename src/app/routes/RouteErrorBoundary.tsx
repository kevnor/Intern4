import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '../../shared/components';

type BoundaryProps = { children: ReactNode };
type BoundaryState = { error: Error | null };

// Without this a render error unmounts the whole app and leaves a blank page.
class Boundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Siden krasjet:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div role="alert" className="mx-auto max-w-2xl space-y-4 px-4 py-16 text-fg">
        <h1 className="text-xl font-semibold">Noe gikk galt på denne siden</h1>
        <p className="text-muted">
          Prøv å laste siden på nytt. Hvis det fortsetter, send meldingen under til den som
          vedlikeholder appen.
        </p>
        <pre className="overflow-x-auto rounded-xl border border-border bg-surface-muted p-3 text-sm">
          {error.message || String(error)}
        </pre>
        <Button onClick={() => window.location.reload()}>Last siden på nytt</Button>
      </div>
    );
  }
}

// Remounts when the user navigates, so one broken page doesn't block the others.
const RouteErrorBoundary = ({ children }: BoundaryProps) => {
  const { pathname } = useLocation();
  return <Boundary key={pathname}>{children}</Boundary>;
};

export default RouteErrorBoundary;
