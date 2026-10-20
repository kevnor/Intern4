import { Loader2 } from 'lucide-react';
import { cn } from '../utils/cn';

type SpinnerProps = {
  className?: string;
  label?: string;
};

export const Spinner = ({ className, label = 'Laster...' }: SpinnerProps) => (
  <span role="status" className="inline-flex items-center">
    <Loader2 aria-hidden="true" className={cn('h-5 w-5 animate-spin', className)} />
    <span className="sr-only">{label}</span>
  </span>
);

export const Skeleton = ({ className }: { className?: string }) => (
  <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-surface-muted', className)} />
);
