import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemePreference } from '../providers/ThemeProvider';
import { cn } from '../../shared/utils/cn';

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Lys', Icon: Sun },
  { value: 'dark', label: 'Mørk', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

export const ThemeSelector = ({ className }: { className?: string }) => {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Utseende"
      className={cn('grid grid-cols-3 gap-1 rounded-xl bg-surface-muted p-1', className)}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const selected = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setPreference(value)}
            className={cn(
              'flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-colors pointer-coarse:min-h-11',
              selected ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg'
            )}
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
};

// Compact header button that cycles light → dark → system.
export const ThemeToggleButton = ({ className }: { className?: string }) => {
  const { preference, resolvedTheme, setPreference } = useTheme();
  const next: ThemePreference =
    preference === 'light' ? 'dark' : preference === 'dark' ? 'system' : 'light';
  const Icon = preference === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;
  const current = OPTIONS.find((option) => option.value === preference)?.label;

  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      aria-label={`Utseende: ${current}. Bytt utseende`}
      title={`Utseende: ${current}`}
      className={cn(
        'inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-header-hover',
        className
      )}
    >
      <Icon aria-hidden="true" className="h-5 w-5" />
    </button>
  );
};
