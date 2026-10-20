import { RefreshCw, Search } from 'lucide-react';
import { controlClasses } from './Field';
import { cn } from '../utils/cn';

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  className?: string;
};

export const SearchInput = ({
  value,
  onChange,
  placeholder = 'Søk...',
  label = 'Søk',
  onRefresh,
  refreshing = false,
  className,
}: SearchInputProps) => (
  <div className={cn('flex items-center gap-2', className)}>
    <div className="relative flex-1">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={controlClasses(false, 'min-h-10 py-2 pl-9')}
      />
    </div>
    {onRefresh && (
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        aria-label="Oppdater"
        title="Oppdater"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border-strong bg-surface text-muted shadow-sm hover:bg-surface-muted hover:text-fg disabled:opacity-50 pointer-coarse:h-11 pointer-coarse:w-11"
      >
        <RefreshCw aria-hidden="true" className={cn('h-4 w-4', refreshing && 'animate-spin')} />
      </button>
    )}
  </div>
);
