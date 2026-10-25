import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '../../shared/components';
import { isChunkLoadError, reportError } from '../../shared/utils/errors';

type ErrorBoundaryProps = { children: ReactNode };
type ErrorBoundaryState = { error: Error | null };

// Without a boundary a render error unmounts the whole app and leaves a blank page.
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(
      error,
      `Siden krasjet${info.componentStack ? ` i${info.componentStack.split('\n')[1] ?? ''}` : ''}`
    );
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const loadFailure = isChunkLoadError(error);

    return (
      <div role="alert" className="mx-auto max-w-2xl space-y-4 px-4 py-16 text-fg">
        <h1 className="text-xl font-semibold">
          {loadFailure ? 'Siden kunne ikke lastes' : 'Noe gikk galt på denne siden'}
        </h1>
        <p className="text-muted">
          {loadFailure
            ? 'Du kan ha en gammel versjon av appen åpen, eller nettverket falt ut. Last siden på nytt.'
            : 'Prøv å laste siden på nytt. Hvis det fortsetter, send meldingen under til den som vedlikeholder appen.'}
        </p>
        <pre className="overflow-x-auto rounded-xl border border-border bg-surface-muted p-3 text-sm">
          {error.message || String(error)}
        </pre>
        <Button onClick={() => window.location.reload()}>Last siden på nytt</Button>
      </div>
    );
  }
}

export default ErrorBoundary;
